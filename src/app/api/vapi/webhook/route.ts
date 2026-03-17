import { createClient } from "@supabase/supabase-js";

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
    transcript?: string | null;
    metadata?: {
      attempt_id?: string | number | null;
    } | null;
  } | null;
  message?: {
    type?: string;
    conversation?: VapiConversationMessage[] | null;
    artifact?: {
      transcript?: string | null;
      messages?: Array<{
        role?: string;
        message?: string;
      }> | null;
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

function asTrimmedString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s ? s : null;
}

function extractAttemptId(body: VapiWebhookBody): number | null {
  const directAttemptId =
    body?.variableValues?.attempt_id ??
    body?.metadata?.attempt_id ??
    body?.attempt_id ??
    body?.call?.metadata?.attempt_id;

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

    console.log("WEBHOOK_PARSED:", {
      messageType,
      attemptId,
      hasTranscript: Boolean(transcript),
      transcriptLength: transcript?.length ?? 0,
    });

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