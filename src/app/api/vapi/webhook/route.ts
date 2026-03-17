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

function extractTranscript(body: VapiWebhookBody): string | null {
  const conversationTranscript = body?.message?.conversation
    ?.map((m) => {
      const role = asTrimmedString(m?.role) || "unknown";
      const content = asTrimmedString(m?.content ?? m?.message);
      if (!content) return null;
      return `${role}: ${content}`;
    })
    .filter(Boolean)
    .join("\n");

  const messagesTranscript = body?.messages
    ?.map((m) => {
      const role = asTrimmedString(m?.role) || "unknown";
      const content = asTrimmedString(m?.content ?? m?.message);
      if (!content) return null;
      return `${role}: ${content}`;
    })
    .filter(Boolean)
    .join("\n");

  return (
    asTrimmedString(conversationTranscript) ||
    asTrimmedString(body?.message?.artifact?.transcript) ||
    asTrimmedString(body?.transcript) ||
    asTrimmedString(body?.call?.transcript) ||
    asTrimmedString(messagesTranscript) ||
    null
  );
}

function buildSummary(transcript: string): string | null {
  const cleaned = transcript.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;

  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentences.length === 0) return cleaned.slice(0, 240) || null;

  const summary = sentences.slice(0, 2).join(" ").trim();
  return summary || cleaned.slice(0, 240) || null;
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

    const summary = buildSummary(transcript);

    const { error } = await supabase.from("call_notes").insert({
      attempt_id: attemptId,
      transcript,
      summary,
    });

    if (error) {
      console.error("WEBHOOK_STORE_ERROR:", error);
    } else {
      console.log("WEBHOOK_STORE_SUCCESS:", {
        attemptId,
        messageType,
      });
    }
  } catch (e) {
    console.error("WEBHOOK_STORE_ERROR:", e);
  }

  return Response.json({ ok: true });
}