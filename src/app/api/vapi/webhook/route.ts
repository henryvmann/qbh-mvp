import { createClient } from "@supabase/supabase-js";
import { classifyCallOutcome } from "../../../../lib/openai/classify-call-outcome";

type JsonRecord = Record<string, unknown>;

type VapiConversationMessage = {
  role?: string;
  content?: string;
  message?: string;
};

type VapiWebhookBody = {
  transcript?: string | null;
  messages?: Array<{
    role?: string;
    content?: string;
    message?: string;
  }>;
  metadata?: {
    attempt_id?: string | number | null;
  } | null;
  attempt_id?: string | number | null;
  variableValues?: {
    attempt_id?: string | number | null;
  } | null;
  call?: {
    id?: string | null;
    status?: string | null;
    endedReason?: string | null;
    endedAt?: string | null;
    transcript?: string | null;
    metadata?: {
      attempt_id?: string | number | null;
    } | null;
  } | null;
  message?: {
    type?: string;
    status?: string | null;
    endedReason?: string | null;
    endedAt?: string | null;
    conversation?: VapiConversationMessage[] | null;
    artifact?: {
      transcript?: string | null;
      messages?: Array<{
        role?: string;
        message?: string;
      }> | null;
      variableValues?: {
        attempt_id?: string | number | null;
      } | null;
      variables?: {
        attempt_id?: string | number | null;
      } | null;
    } | null;
    call?: {
      id?: string | null;
      status?: string | null;
      endedReason?: string | null;
      endedAt?: string | null;
      assistantOverrides?: {
        variableValues?: {
          attempt_id?: string | number | null;
        } | null;
      } | null;
    } | null;
    assistant?: {
      variableValues?: {
        attempt_id?: string | number | null;
      } | null;
    } | null;
  } | null;
};

type StructuredBookingNotes = {
  booking_summary: string | null;
  appointment_time_spoken: string | null;
  office_instructions: string | null;
  documents_to_bring: string | null;
  follow_up_notes: string | null;
};

type ActiveAttemptStatus = "CREATED" | "CALLING" | "PROPOSED";

function asTrimmedString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s ? s : null;
}

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonRecord;
}

function extractAttemptId(body: VapiWebhookBody): number | null {
  const directAttemptId =
    body?.variableValues?.attempt_id ??
    body?.metadata?.attempt_id ??
    body?.attempt_id ??
    body?.call?.metadata?.attempt_id ??
    body?.message?.artifact?.variableValues?.attempt_id ??
    body?.message?.artifact?.variables?.attempt_id ??
    body?.message?.call?.assistantOverrides?.variableValues?.attempt_id ??
    body?.message?.assistant?.variableValues?.attempt_id;

  const direct = asTrimmedString(directAttemptId);
  if (direct && /^\d+$/.test(direct)) {
    return Number(direct);
  }

  const systemContent = body?.message?.conversation?.find(
    (m) => m?.role === "system" && typeof m?.content === "string"
  )?.content;

  const matched = systemContent?.match(/attempt_id\s*=\s*(\d+)/i)?.[1];
  if (matched) {
    return Number(matched);
  }

  return null;
}

function normalizeTranscriptLine(message: {
  role?: string;
  content?: string;
  message?: string;
}): string | null {
  const role = asTrimmedString(message?.role)?.toLowerCase() || "unknown";

  if (role === "system") {
    return null;
  }

  const content = asTrimmedString(message?.content ?? message?.message);
  if (!content) {
    return null;
  }

  return `${role}: ${content}`;
}

function extractTranscript(body: VapiWebhookBody): string | null {
  const conversationTranscript = body?.message?.conversation
    ?.map(normalizeTranscriptLine)
    .filter(Boolean)
    .join("\n");

  const artifactTranscript = body?.message?.artifact?.messages
    ?.map((m) =>
      normalizeTranscriptLine({
        role: m?.role,
        message: m?.message,
      })
    )
    .filter(Boolean)
    .join("\n");

  const messagesTranscript = body?.messages
    ?.map(normalizeTranscriptLine)
    .filter(Boolean)
    .join("\n");

  return (
    asTrimmedString(conversationTranscript) ||
    asTrimmedString(artifactTranscript) ||
    asTrimmedString(body?.message?.artifact?.transcript) ||
    asTrimmedString(body?.transcript) ||
    asTrimmedString(body?.call?.transcript) ||
    asTrimmedString(messagesTranscript) ||
    null
  );
}

function extractAppointmentTimeSpoken(transcript: string): string | null {
  const patterns = [
    /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?\s+at\s+\d{1,2}(?::\d{2})?\s?(?:am|pm)\b/i,
    /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}\s+at\s+\d{1,2}(?::\d{2})?\s?(?:am|pm)\b/i,
  ];

  for (const pattern of patterns) {
    const match = transcript.match(pattern)?.[0];
    if (match) return match.trim();
  }

  return null;
}

function extractDocumentsToBring(transcript: string): string | null {
  const lower = transcript.toLowerCase();
  const docPhrases: string[] = [];

  if (lower.includes("photo id")) docPhrases.push("Photo ID");
  if (lower.includes("insurance")) docPhrases.push("Insurance information");
  if (lower.includes("medical records")) docPhrases.push("Recent medical records");
  if (lower.includes("blood work")) docPhrases.push("Recent blood work");
  if (lower.includes("scan")) docPhrases.push("Recent scans");

  if (docPhrases.length === 0) return null;

  return Array.from(new Set(docPhrases)).join(", ");
}

function extractOfficeInstructions(lines: string[]): string | null {
  const instructionLines = lines.filter((line) => {
    const lower = line.toLowerCase();
    return (
      lower.includes("bring ") ||
      lower.includes("please bring") ||
      lower.includes("need to bring") ||
      lower.includes("let the patient know") ||
      lower.includes("insurance information") ||
      lower.includes("medical records") ||
      lower.includes("photo id")
    );
  });

  if (instructionLines.length === 0) return null;

  return instructionLines.slice(0, 2).join(" ");
}

function extractFollowUpNotes(lines: string[]): string | null {
  const followUpLines = lines.filter((line) => {
    const lower = line.toLowerCase();
    return (
      lower.includes("call back") ||
      lower.includes("follow up") ||
      lower.includes("follow-up") ||
      lower.includes("confirm") ||
      lower.includes("remind") ||
      lower.includes("arrive") ||
      lower.includes("before the appointment")
    );
  });

  if (followUpLines.length === 0) return null;

  return followUpLines.slice(0, 2).join(" ");
}

function buildStructuredBookingNotes(transcript: string): StructuredBookingNotes {
  const lines = transcript
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((line) => {
      const lower = line.toLowerCase();

      if (lower.startsWith("tool:")) return false;
      if (lower.includes('"status":"ok"')) return false;
      if (lower.includes('"next_action"')) return false;
      if (lower.includes('"calendar_event_id"')) return false;
      if (lower.includes('"provider_id"')) return false;
      if (lower.includes('"user_id"')) return false;
      if (lower.includes('"app_user_id"')) return false;

      return true;
    });

  const appointmentTimeSpoken = extractAppointmentTimeSpoken(transcript);
  const documentsToBring = extractDocumentsToBring(transcript);
  const officeInstructions = extractOfficeInstructions(lines);
  const followUpNotes = extractFollowUpNotes(lines);

  const summaryParts: string[] = [];

  if (appointmentTimeSpoken) {
    summaryParts.push(`Appointment confirmed for ${appointmentTimeSpoken}.`);
  } else {
    const confirmationLine = lines.find((line) => {
      const lower = line.toLowerCase();
      return (
        lower.includes("all set") ||
        lower.includes("confirmed") ||
        lower.includes("let's book it") ||
        lower.includes("that works")
      );
    });

    if (confirmationLine) {
      summaryParts.push(confirmationLine);
    }
  }

  if (documentsToBring) {
    summaryParts.push(`Bring ${documentsToBring}.`);
  } else if (officeInstructions) {
    summaryParts.push(officeInstructions);
  }

  if (followUpNotes && !summaryParts.join(" ").includes(followUpNotes)) {
    summaryParts.push(followUpNotes);
  }

  const bookingSummaryRaw = summaryParts.join(" ").replace(/\s+/g, " ").trim();

  return {
    booking_summary: bookingSummaryRaw || null,
    appointment_time_spoken: appointmentTimeSpoken,
    office_instructions: officeInstructions,
    documents_to_bring: documentsToBring,
    follow_up_notes: followUpNotes,
  };
}

function isTerminalWebhook(body: VapiWebhookBody): boolean {
  const messageType = asTrimmedString(body?.message?.type)?.toLowerCase() ?? "";
  const messageStatus = asTrimmedString(body?.message?.status)?.toLowerCase() ?? "";
  const messageEndedReason =
    asTrimmedString(body?.message?.endedReason)?.toLowerCase() ?? "";

  const nestedCallStatus =
    asTrimmedString(body?.message?.call?.status)?.toLowerCase() ?? "";
  const nestedCallEndedReason =
    asTrimmedString(body?.message?.call?.endedReason)?.toLowerCase() ?? "";

  const callStatus = asTrimmedString(body?.call?.status)?.toLowerCase() ?? "";
  const callEndedReason = asTrimmedString(body?.call?.endedReason)?.toLowerCase() ?? "";

  if (messageType.includes("end")) return true;
  if (messageType.includes("hang")) return true;
  if (messageType.includes("status-update") && messageStatus === "ended") return true;
  if (messageStatus === "ended") return true;
  if (Boolean(messageEndedReason)) return true;
  if (nestedCallStatus === "ended") return true;
  if (Boolean(nestedCallEndedReason)) return true;
  if (callStatus === "ended") return true;
  if (Boolean(callEndedReason)) return true;

  return false;
}

async function reconcileAttemptIfTerminal(params: {
  supabase: any;
  attemptId: number;
  body: VapiWebhookBody;
}) {
  const { supabase, attemptId, body } = params;

  if (!isTerminalWebhook(body)) {
    return;
  }

  const { data: attemptData, error: attemptReadError } = await supabase
    .from("schedule_attempts")
    .select("id,status,metadata")
    .eq("id", attemptId)
    .maybeSingle();

  if (attemptReadError || !attemptData) {
    console.error("WEBHOOK_RECONCILE_ATTEMPT_READ_ERROR:", attemptReadError);
    return;
  }

  const attemptRow = attemptData as {
    id: number;
    status: string | null;
    metadata: unknown;
  };

  const currentStatus = asTrimmedString(attemptRow.status)?.toUpperCase() ?? "";
  const activeStatuses: ActiveAttemptStatus[] = ["CREATED", "CALLING", "PROPOSED"];

  if (!activeStatuses.includes(currentStatus as ActiveAttemptStatus)) {
    return;
  }

  const { data: existingEventData, error: existingEventError } = await supabase
    .from("calendar_events")
    .select("id,status")
    .eq("attempt_id", attemptId)
    .eq("status", "confirmed")
    .limit(1)
    .maybeSingle();

  if (existingEventError) {
    console.error("WEBHOOK_RECONCILE_EVENT_READ_ERROR:", existingEventError);
    return;
  }

  const existingEvent = existingEventData as { id?: string | null } | null;

  if (existingEvent && existingEvent.id) {
    return;
  }

  const metadata = asRecord(attemptRow.metadata) ?? {};
  const nextMetadata = {
    ...metadata,
    last_event: "CALL_ENDED_WITHOUT_BOOKING",
    vapi_terminal_status:
      asTrimmedString(body?.message?.status) ??
      asTrimmedString(body?.message?.call?.status) ??
      asTrimmedString(body?.call?.status),
    vapi_ended_reason:
      asTrimmedString(body?.message?.endedReason) ??
      asTrimmedString(body?.message?.call?.endedReason) ??
      asTrimmedString(body?.call?.endedReason),
    vapi_ended_at:
      asTrimmedString(body?.message?.endedAt) ??
      asTrimmedString(body?.message?.call?.endedAt) ??
      asTrimmedString(body?.call?.endedAt),
  };

  const { error: updateError } = await supabase
    .from("schedule_attempts")
    .update({
      status: "FAILED",
      metadata: nextMetadata,
    })
    .eq("id", attemptId)
    .in("status", activeStatuses);

  if (updateError) {
    console.error("WEBHOOK_RECONCILE_UPDATE_ERROR:", updateError);
  } else {
    console.log("WEBHOOK_RECONCILE_UPDATE_SUCCESS:", {
      attemptId,
      previousStatus: currentStatus,
      nextStatus: "FAILED",
      last_event: "CALL_ENDED_WITHOUT_BOOKING",
    });
  }
}

export async function POST(req: Request) {
  const body: VapiWebhookBody = await req.json().catch(() => ({}));

  console.log("=== VAPI WEBHOOK START ===");
  console.log(JSON.stringify(body, null, 2));
  console.log("=== VAPI WEBHOOK END ===");

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("WEBHOOK_CONFIG_ERROR: Missing Supabase env vars");
    return Response.json({ ok: true });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  try {
    const messageType = asTrimmedString(body?.message?.type);
    const attemptId = extractAttemptId(body);
    const transcript = extractTranscript(body);
    const terminalStatus =
      asTrimmedString(body?.message?.status) ??
      asTrimmedString(body?.message?.call?.status) ??
      asTrimmedString(body?.call?.status);
    const endedReason =
      asTrimmedString(body?.message?.endedReason) ??
      asTrimmedString(body?.message?.call?.endedReason) ??
      asTrimmedString(body?.call?.endedReason);

    console.log("WEBHOOK_PARSED:", {
      messageType,
      attemptId,
      hasTranscript: Boolean(transcript),
      transcriptLength: transcript?.length ?? 0,
      isTerminal: isTerminalWebhook(body),
      messageStatus: asTrimmedString(body?.message?.status),
      messageEndedReason: asTrimmedString(body?.message?.endedReason),
      nestedCallStatus: asTrimmedString(body?.message?.call?.status),
      nestedCallEndedReason: asTrimmedString(body?.message?.call?.endedReason),
      callStatus: asTrimmedString(body?.call?.status),
      callEndedReason: asTrimmedString(body?.call?.endedReason),
    });

    if (attemptId) {
      await reconcileAttemptIfTerminal({
        supabase,
        attemptId,
        body,
      });
    }

    if (!attemptId || !transcript) {
      console.log("WEBHOOK_SKIP_STORE:", {
        reason: !attemptId ? "missing_attempt_id" : "missing_transcript",
        messageType,
      });

      return Response.json({ ok: true });
    }

    const structured = buildStructuredBookingNotes(transcript);
    const legacySummary =
      structured.booking_summary ||
      transcript.slice(0, 500).replace(/\s+/g, " ").trim() ||
      null;

    const { data: attemptForClassification } = await supabase
      .from("schedule_attempts")
      .select("metadata")
      .eq("id", attemptId)
      .maybeSingle();

    const attemptMetadata = asRecord(attemptForClassification?.metadata);
    const flowModeRaw = attemptMetadata?.flow_mode;
    const flowMode =
      flowModeRaw === "BOOK" || flowModeRaw === "ADJUST" ? flowModeRaw : "UNKNOWN";

    const classification = await classifyCallOutcome({
      transcript,
      flowMode,
      providerName: null,
      providerType: null,
      terminalStatus,
      endedReason,
    });

    if (classification) {
      const { error: classificationUpdateError } = await supabase
        .from("schedule_attempts")
        .update({
          metadata: {
            ...attemptMetadata,
            openai_call_classification: classification,
          },
        })
        .eq("id", attemptId);

      if (classificationUpdateError) {
        console.error(
          "WEBHOOK_CLASSIFICATION_UPDATE_ERROR:",
          classificationUpdateError
        );
      } else {
        console.log("WEBHOOK_CLASSIFICATION_UPDATE_SUCCESS:", {
          attemptId,
          failureClass: classification.failure_class,
          retryPolicyHint: classification.retry_policy_hint,
        });
      }
    }

    const { error } = await supabase.from("call_notes").insert({
      attempt_id: attemptId,
      transcript,
      summary: legacySummary,
      booking_summary: structured.booking_summary,
      appointment_time_spoken: structured.appointment_time_spoken,
      office_instructions: structured.office_instructions,
      documents_to_bring: structured.documents_to_bring,
      follow_up_notes: structured.follow_up_notes,
    });

    if (error) {
      console.error("WEBHOOK_STORE_ERROR:", error);
    } else {
      console.log("WEBHOOK_STORE_SUCCESS:", {
        attemptId,
        messageType,
        booking_summary: structured.booking_summary,
      });
    }
  } catch (e) {
    console.error("WEBHOOK_STORE_ERROR:", e);
  }

  return Response.json({ ok: true });
}