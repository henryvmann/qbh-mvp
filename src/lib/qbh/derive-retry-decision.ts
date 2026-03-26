type JsonRecord = Record<string, unknown>;

export type RetryStrategy =
  | "NONE"
  | "NEXT_BUSINESS_HOURS"
  | "CALLBACK_WINDOW"
  | "SOON";

export type RetryNextAction =
  | "BLOCK"
  | "AUTO_RETRY"
  | "USER_REQUIRED"
  | "REVIEW_REQUIRED";

export type RetryDecision = {
  retry_allowed: boolean;
  retry_strategy: RetryStrategy;
  next_action: RetryNextAction;
  reason: string;
  retry_after_iso: string | null;
};

type RetryPolicyHint =
  | "RETRY_SOON"
  | "RETRY_NEXT_BUSINESS_HOURS"
  | "RETRY_AFTER_CALLBACK_WINDOW"
  | "REQUIRES_USER_INPUT"
  | "DO_NOT_RETRY";

type FailureClass =
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

type CallOutcomeClassification = {
  failure_class: FailureClass | null;
  retry_policy_hint: RetryPolicyHint;
  suggested_retry_after_iso: string | null;
};

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as JsonRecord;
}

function asTrimmedString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s ? s : null;
}

function getClassification(
  metadata: unknown
): CallOutcomeClassification | null {
  const metadataRecord = asRecord(metadata);
  const classification = asRecord(metadataRecord?.openai_call_classification);

  if (!classification) return null;

  const failureClassRaw = asTrimmedString(classification.failure_class);
  const retryPolicyHintRaw = asTrimmedString(classification.retry_policy_hint);
  const retryAfterIso = asTrimmedString(classification.suggested_retry_after_iso);

  const failure_class = isFailureClass(failureClassRaw) ? failureClassRaw : null;
  const retry_policy_hint = isRetryPolicyHint(retryPolicyHintRaw)
    ? retryPolicyHintRaw
    : null;

  if (!retry_policy_hint) return null;

  return {
    failure_class,
    retry_policy_hint,
    suggested_retry_after_iso: retryAfterIso,
  };
}

function isRetryPolicyHint(value: string | null): value is RetryPolicyHint {
  return (
    value === "RETRY_SOON" ||
    value === "RETRY_NEXT_BUSINESS_HOURS" ||
    value === "RETRY_AFTER_CALLBACK_WINDOW" ||
    value === "REQUIRES_USER_INPUT" ||
    value === "DO_NOT_RETRY"
  );
}

function isFailureClass(value: string | null): value is FailureClass {
  return (
    value === "OFFICE_CLOSED" ||
    value === "VOICEMAIL" ||
    value === "NO_ANSWER" ||
    value === "BUSY_SIGNAL" ||
    value === "CALL_DROPPED" ||
    value === "TRANSFER_LOOP" ||
    value === "CALLBACK_REQUESTED" ||
    value === "NOT_ACCEPTING_NEW_PATIENTS" ||
    value === "NO_AVAILABILITY_GIVEN" ||
    value === "WRONG_NUMBER" ||
    value === "PROVIDER_NOT_FOUND" ||
    value === "NEEDS_REFERRAL" ||
    value === "INSURANCE_NOT_ACCEPTED" ||
    value === "PATIENT_INFO_REQUIRED" ||
    value === "CALENDAR_CONFLICT" ||
    value === "UNKNOWN_FAILURE"
  );
}

export function deriveRetryDecision(metadata: unknown): RetryDecision | null {
  const classification = getClassification(metadata);

  if (!classification) {
    return null;
  }

  const { failure_class, retry_policy_hint, suggested_retry_after_iso } =
    classification;

  switch (failure_class) {
    case "NOT_ACCEPTING_NEW_PATIENTS":
    case "WRONG_NUMBER":
    case "PROVIDER_NOT_FOUND":
      return {
        retry_allowed: false,
        retry_strategy: "NONE",
        next_action: "BLOCK",
        reason: failure_class,
        retry_after_iso: null,
      };

    case "CALENDAR_CONFLICT":
    case "NEEDS_REFERRAL":
    case "INSURANCE_NOT_ACCEPTED":
    case "PATIENT_INFO_REQUIRED":
      return {
        retry_allowed: false,
        retry_strategy: "NONE",
        next_action: "USER_REQUIRED",
        reason: failure_class,
        retry_after_iso: null,
      };

    case "OFFICE_CLOSED":
      return {
        retry_allowed: true,
        retry_strategy: "NEXT_BUSINESS_HOURS",
        next_action: "AUTO_RETRY",
        reason: failure_class,
        retry_after_iso: suggested_retry_after_iso,
      };

    case "VOICEMAIL":
    case "CALLBACK_REQUESTED":
      return {
        retry_allowed: true,
        retry_strategy: suggested_retry_after_iso
          ? "CALLBACK_WINDOW"
          : "NEXT_BUSINESS_HOURS",
        next_action: "AUTO_RETRY",
        reason: failure_class,
        retry_after_iso: suggested_retry_after_iso,
      };

    case "NO_ANSWER":
    case "BUSY_SIGNAL":
    case "CALL_DROPPED":
    case "TRANSFER_LOOP":
    case "NO_AVAILABILITY_GIVEN":
      return {
        retry_allowed: true,
        retry_strategy:
          retry_policy_hint === "RETRY_SOON" ? "SOON" : "NEXT_BUSINESS_HOURS",
        next_action: "AUTO_RETRY",
        reason: failure_class,
        retry_after_iso: suggested_retry_after_iso,
      };

    case "UNKNOWN_FAILURE":
      return {
        retry_allowed: false,
        retry_strategy: "NONE",
        next_action: "REVIEW_REQUIRED",
        reason: failure_class,
        retry_after_iso: null,
      };

    default:
      break;
  }

  switch (retry_policy_hint) {
    case "DO_NOT_RETRY":
      return {
        retry_allowed: false,
        retry_strategy: "NONE",
        next_action: "BLOCK",
        reason: failure_class ?? "DO_NOT_RETRY",
        retry_after_iso: null,
      };

    case "REQUIRES_USER_INPUT":
      return {
        retry_allowed: false,
        retry_strategy: "NONE",
        next_action: "USER_REQUIRED",
        reason: failure_class ?? "REQUIRES_USER_INPUT",
        retry_after_iso: null,
      };

    case "RETRY_AFTER_CALLBACK_WINDOW":
      return {
        retry_allowed: true,
        retry_strategy: suggested_retry_after_iso
          ? "CALLBACK_WINDOW"
          : "NEXT_BUSINESS_HOURS",
        next_action: "AUTO_RETRY",
        reason: failure_class ?? "RETRY_AFTER_CALLBACK_WINDOW",
        retry_after_iso: suggested_retry_after_iso,
      };

    case "RETRY_NEXT_BUSINESS_HOURS":
      return {
        retry_allowed: true,
        retry_strategy: "NEXT_BUSINESS_HOURS",
        next_action: "AUTO_RETRY",
        reason: failure_class ?? "RETRY_NEXT_BUSINESS_HOURS",
        retry_after_iso: suggested_retry_after_iso,
      };

    case "RETRY_SOON":
      return {
        retry_allowed: true,
        retry_strategy: "SOON",
        next_action: "AUTO_RETRY",
        reason: failure_class ?? "RETRY_SOON",
        retry_after_iso: suggested_retry_after_iso,
      };

    default:
      return {
        retry_allowed: false,
        retry_strategy: "NONE",
        next_action: "REVIEW_REQUIRED",
        reason: failure_class ?? "UNKNOWN_RETRY_POLICY",
        retry_after_iso: null,
      };
  }
}