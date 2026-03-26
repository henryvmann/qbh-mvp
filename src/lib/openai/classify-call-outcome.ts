import OpenAI from "openai";

export type QbhFailureClass =
  | "OFFICE_CLOSED"
  | "VOICEMAIL"
  | "NO_ANSWER"
  | "BUSY_SIGNAL"
  | "CALL_DROPPED"
  | "TRANSFER_LOOP"
  | "CALLBACK_REQUESTED"
  | "NOT_ACCEPTING_NEW_PATIENTS"
  | "NO_AVAILABILITY_GIVEN"
  | "WRONG_NUMBER"
  | "PROVIDER_NOT_FOUND"
  | "NEEDS_REFERRAL"
  | "INSURANCE_NOT_ACCEPTED"
  | "PATIENT_INFO_REQUIRED"
  | "CALENDAR_CONFLICT"
  | "UNKNOWN_FAILURE";

export type QbhRetryPolicyHint =
  | "RETRY_SOON"
  | "RETRY_NEXT_BUSINESS_HOURS"
  | "RETRY_AFTER_CALLBACK_WINDOW"
  | "REQUIRES_USER_INPUT"
  | "DO_NOT_RETRY";

export type QbhCallOutcomeClassification = {
  outcome_type: "BOOKED_CONFIRMED" | "FAILED" | "INCOMPLETE";
  failure_class: QbhFailureClass | null;
  retry_policy_hint: QbhRetryPolicyHint;
  user_input_required: boolean;
  call_summary: string;
  reason_summary: string;
  office_status:
    | "OPEN"
    | "CLOSED"
    | "VOICEMAIL_ONLY"
    | "DECLINED_NEW_PATIENT"
    | "UNKNOWN"
    | null;
  callback_requested: boolean;
  suggested_retry_after_iso: string | null;
  confidence: number;
  evidence: string[];
};

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const RESPONSE_FORMAT = {
  type: "json_schema" as const,
  name: "qbh_call_outcome_classification",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      outcome_type: {
        type: "string",
        enum: ["BOOKED_CONFIRMED", "FAILED", "INCOMPLETE"],
      },
      failure_class: {
        type: ["string", "null"],
        enum: [
          "OFFICE_CLOSED",
          "VOICEMAIL",
          "NO_ANSWER",
          "BUSY_SIGNAL",
          "CALL_DROPPED",
          "TRANSFER_LOOP",
          "CALLBACK_REQUESTED",
          "NOT_ACCEPTING_NEW_PATIENTS",
          "NO_AVAILABILITY_GIVEN",
          "WRONG_NUMBER",
          "PROVIDER_NOT_FOUND",
          "NEEDS_REFERRAL",
          "INSURANCE_NOT_ACCEPTED",
          "PATIENT_INFO_REQUIRED",
          "CALENDAR_CONFLICT",
          "UNKNOWN_FAILURE",
          null,
        ],
      },
      retry_policy_hint: {
        type: "string",
        enum: [
          "RETRY_SOON",
          "RETRY_NEXT_BUSINESS_HOURS",
          "RETRY_AFTER_CALLBACK_WINDOW",
          "REQUIRES_USER_INPUT",
          "DO_NOT_RETRY",
        ],
      },
      user_input_required: {
        type: "boolean",
      },
      call_summary: {
        type: "string",
      },
      reason_summary: {
        type: "string",
      },
      office_status: {
        type: ["string", "null"],
        enum: [
          "OPEN",
          "CLOSED",
          "VOICEMAIL_ONLY",
          "DECLINED_NEW_PATIENT",
          "UNKNOWN",
          null,
        ],
      },
      callback_requested: {
        type: "boolean",
      },
      suggested_retry_after_iso: {
        type: ["string", "null"],
      },
      confidence: {
        type: "number",
      },
      evidence: {
        type: "array",
        items: {
          type: "string",
        },
      },
    },
    required: [
      "outcome_type",
      "failure_class",
      "retry_policy_hint",
      "user_input_required",
      "call_summary",
      "reason_summary",
      "office_status",
      "callback_requested",
      "suggested_retry_after_iso",
      "confidence",
      "evidence",
    ],
  },
};

function parseClassification(
  content: string | null | undefined
): QbhCallOutcomeClassification | null {
  if (!content) return null;

  try {
    return JSON.parse(content) as QbhCallOutcomeClassification;
  } catch (error) {
    console.error("OPENAI_CLASSIFICATION_PARSE_ERROR:", error);
    return null;
  }
}

export async function classifyCallOutcome(params: {
  transcript: string;
  flowMode: "BOOK" | "ADJUST" | "UNKNOWN";
  providerName?: string | null;
  providerType?: string | null;
  terminalStatus?: string | null;
  endedReason?: string | null;
}): Promise<QbhCallOutcomeClassification | null> {
  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_CONFIG_ERROR: Missing OPENAI_API_KEY");
    return null;
  }

  const prompt = [
    "You classify healthcare appointment booking call outcomes for QBH.",
    "Return only valid JSON matching the provided schema.",
    "Base classification only on the provided evidence.",
    "Do not invent facts.",
    "If an office explicitly says they are not accepting new patients, use failure_class = NOT_ACCEPTING_NEW_PATIENTS and retry_policy_hint = DO_NOT_RETRY.",
    "If the office is closed, prefer OFFICE_CLOSED with a retryable hint.",
    "If evidence is weak, use UNKNOWN_FAILURE.",
    "For call_summary: write 1-2 plain English sentences describing what happened, suitable for showing directly to the patient. Be specific and human. Examples: 'The office was closed when QBH called — QBH will try again during business hours.' or 'QBH successfully booked your appointment for March 15th at 2:00 PM.' or 'The office said they are not currently accepting new patients.' Do not use jargon or internal codes.",
    "",
    "EVIDENCE:",
    JSON.stringify(
      {
        flow_mode: params.flowMode,
        provider_name: params.providerName ?? null,
        provider_type: params.providerType ?? null,
        terminal_status: params.terminalStatus ?? null,
        ended_reason: params.endedReason ?? null,
        transcript: params.transcript,
      },
      null,
      2
    ),
  ].join("\n");

  try {
    const response = await client.responses.create({
      model: "gpt-5.4-mini",
      input: prompt,
      text: {
        format: RESPONSE_FORMAT,
      },
    });

    return parseClassification(response.output_text);
  } catch (error) {
    console.error("OPENAI_CLASSIFICATION_ERROR:", error);
    return null;
  }
}