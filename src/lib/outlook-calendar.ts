import { supabaseAdmin } from "./supabase-server";

const OUTLOOK_OAUTH_BASE =
  "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const OUTLOOK_TOKEN_URL =
  "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const OUTLOOK_USERINFO_URL = "https://graph.microsoft.com/v1.0/me";
const OUTLOOK_CALENDARVIEW_URL =
  "https://graph.microsoft.com/v1.0/me/calendarview";
const OUTLOOK_CALENDAR_PROVIDER_NAME = "Outlook Calendar";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function requireAppUser(appUserId: string): Promise<void> {
  const cleanedAppUserId = String(appUserId || "").trim();

  if (!cleanedAppUserId) {
    throw new Error("Missing app_user_id");
  }

  const { data, error } = await supabaseAdmin
    .from("app_users")
    .select("id")
    .eq("id", cleanedAppUserId)
    .single();

  if (error || !data?.id) {
    throw new Error("Invalid app_user_id");
  }
}

async function ensureCalendarIntegration(
  appUserId: string
): Promise<{ id: string }> {
  const cleanedAppUserId = String(appUserId || "").trim();

  if (!cleanedAppUserId) {
    throw new Error("Missing app_user_id for calendar integration");
  }

  await requireAppUser(cleanedAppUserId);

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("integrations")
    .select("id")
    .eq("app_user_id", cleanedAppUserId)
    .eq("integration_type", "calendar")
    .in("status", ["active", "connected"])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing?.id) {
    return { id: existing.id };
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("integrations")
    .insert({
      app_user_id: cleanedAppUserId,
      integration_type: "calendar",
      status: "active",
    })
    .select("id")
    .single();

  if (insertError || !inserted?.id) {
    throw new Error(
      insertError?.message || "Failed to create calendar integration"
    );
  }

  return { id: inserted.id };
}

export function getOutlookClientId(): string {
  return requireEnv("OUTLOOK_CLIENT_ID");
}

export function getOutlookClientSecret(): string {
  return requireEnv("OUTLOOK_CLIENT_SECRET");
}

export function getOutlookRedirectUri(): string {
  return requireEnv("OUTLOOK_CALENDAR_REDIRECT_URI");
}

export function getOutlookCalendarScopes(): string[] {
  return [
    "openid",
    "email",
    "profile",
    "offline_access",
    "Calendars.Read",
  ];
}

export async function ensureOutlookCalendarProvider(
  appUserId: string
): Promise<{ id: string; name: string }> {
  const cleanedAppUserId = String(appUserId || "").trim();

  if (!cleanedAppUserId) {
    throw new Error("Missing app_user_id for Outlook Calendar provider");
  }

  await requireAppUser(cleanedAppUserId);

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("providers")
    .select("id,name")
    .eq("app_user_id", cleanedAppUserId)
    .eq("name", OUTLOOK_CALENDAR_PROVIDER_NAME)
    .eq("status", "active")
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing?.id) {
    return {
      id: existing.id,
      name: existing.name,
    };
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("providers")
    .insert({
      app_user_id: cleanedAppUserId,
      name: OUTLOOK_CALENDAR_PROVIDER_NAME,
      status: "active",
      provider_type: "calendar",
      guessed_portal_brand: "outlook_calendar",
      guessed_portal_confidence: 1,
    })
    .select("id,name")
    .single();

  if (insertError) {
    const { data: retryExisting, error: retryError } = await supabaseAdmin
      .from("providers")
      .select("id,name")
      .eq("app_user_id", cleanedAppUserId)
      .eq("name", OUTLOOK_CALENDAR_PROVIDER_NAME)
      .eq("status", "active")
      .maybeSingle();

    if (retryError) {
      throw new Error(retryError.message);
    }

    if (retryExisting?.id) {
      return {
        id: retryExisting.id,
        name: retryExisting.name,
      };
    }

    throw new Error(insertError.message);
  }

  return {
    id: inserted.id,
    name: inserted.name,
  };
}

export async function buildOutlookCalendarState(
  appUserId: string
): Promise<string> {
  const provider = await ensureOutlookCalendarProvider(appUserId);

  return JSON.stringify({
    app_user_id: appUserId,
    provider_id: provider.id,
    provider_name: provider.name,
    provider: "outlook_calendar",
  });
}

export function parseOutlookCalendarState(
  rawState: string | null | undefined
): {
  app_user_id: string;
  provider_id: string;
  provider_name: string;
  provider: string;
} {
  if (!rawState) {
    throw new Error("Missing Outlook OAuth state");
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(rawState);
  } catch {
    throw new Error("Invalid Outlook OAuth state");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid Outlook OAuth state payload");
  }

  const appUserId =
    "app_user_id" in parsed && typeof parsed.app_user_id === "string"
      ? parsed.app_user_id.trim()
      : "";

  const providerId =
    "provider_id" in parsed && typeof parsed.provider_id === "string"
      ? parsed.provider_id.trim()
      : "";

  const providerName =
    "provider_name" in parsed && typeof parsed.provider_name === "string"
      ? parsed.provider_name.trim()
      : OUTLOOK_CALENDAR_PROVIDER_NAME;

  const provider =
    "provider" in parsed && typeof parsed.provider === "string"
      ? parsed.provider
      : "outlook_calendar";

  if (!appUserId) {
    throw new Error("Outlook OAuth state missing app_user_id");
  }

  if (!providerId) {
    throw new Error("Outlook OAuth state missing provider_id");
  }

  return {
    app_user_id: appUserId,
    provider_id: providerId,
    provider_name: providerName,
    provider,
  };
}

export async function buildOutlookCalendarAuthUrl(
  appUserId: string
): Promise<string> {
  const clientId = getOutlookClientId();
  const redirectUri = getOutlookRedirectUri();
  const scope = getOutlookCalendarScopes().join(" ");
  const state = await buildOutlookCalendarState(appUserId);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    response_mode: "query",
    prompt: "consent",
    scope,
    state,
  });

  return `${OUTLOOK_OAUTH_BASE}?${params.toString()}`;
}

export type OutlookTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
  id_token?: string;
};

type StoredOutlookConnectionRow = {
  id: string;
  integration_id: string;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  provider: string;
  external_account_id: string | null;
};

export type OutlookCalendarConnection = {
  id: string;
  integration_id: string;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  provider: string;
  external_account_id: string | null;
};

export type OutlookUserInfo = {
  id: string;
  displayName?: string;
  mail?: string;
};

export type OutlookCalendarEvent = {
  subject: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  showAs: string;
};

export type OutlookCalendarEventsResult = {
  timeMin: string;
  timeMax: string;
  events: OutlookCalendarEvent[];
};

function isTokenExpiringSoon(iso: string | null | undefined): boolean {
  if (!iso) return true;

  const expiresAt = new Date(iso).getTime();
  if (!Number.isFinite(expiresAt)) return true;

  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;

  return expiresAt <= now + fiveMinutes;
}

function computeExpiresAt(expiresIn?: number): string | null {
  if (!expiresIn || !Number.isFinite(expiresIn)) return null;
  return new Date(Date.now() + expiresIn * 1000).toISOString();
}

export async function exchangeOutlookCalendarCode(
  code: string
): Promise<OutlookTokenResponse> {
  const clientId = getOutlookClientId();
  const clientSecret = getOutlookClientSecret();
  const redirectUri = getOutlookRedirectUri();

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const response = await fetch(OUTLOOK_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    cache: "no-store",
  });

  const json = (await response.json().catch(() => null)) as
    | (Partial<OutlookTokenResponse> & {
        error?: string;
        error_description?: string;
      })
    | null;

  if (
    !response.ok ||
    !json?.access_token ||
    !json?.expires_in ||
    !json?.token_type
  ) {
    const message =
      json?.error_description ||
      json?.error ||
      "Failed to exchange Outlook authorization code";
    throw new Error(message);
  }

  return {
    access_token: json.access_token,
    expires_in: json.expires_in,
    refresh_token: json.refresh_token,
    scope: json.scope || "",
    token_type: json.token_type,
    id_token: json.id_token,
  };
}

export async function refreshOutlookCalendarToken(
  refreshToken: string
): Promise<OutlookTokenResponse> {
  const clientId = getOutlookClientId();
  const clientSecret = getOutlookClientSecret();

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch(OUTLOOK_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    cache: "no-store",
  });

  const json = (await response.json().catch(() => null)) as
    | (Partial<OutlookTokenResponse> & {
        error?: string;
        error_description?: string;
      })
    | null;

  if (!response.ok || !json?.access_token || !json?.token_type) {
    const message =
      json?.error_description ||
      json?.error ||
      "Failed to refresh Outlook access token";
    throw new Error(message);
  }

  return {
    access_token: json.access_token,
    expires_in: Number(json.expires_in || 3600),
    refresh_token: json.refresh_token ?? refreshToken,
    scope: json.scope || "",
    token_type: json.token_type,
    id_token: json.id_token,
  };
}

export async function fetchOutlookUserInfo(
  accessToken: string
): Promise<OutlookUserInfo> {
  const response = await fetch(OUTLOOK_USERINFO_URL, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  const json = (await response.json().catch(() => null)) as
    | (Partial<OutlookUserInfo> & {
        error?: { code?: string; message?: string };
      })
    | null;

  if (!response.ok || !json?.id) {
    const message =
      json?.error?.message || "Failed to fetch Outlook user info";
    throw new Error(message);
  }

  return {
    id: json.id,
    displayName:
      typeof json.displayName === "string" ? json.displayName : undefined,
    mail: typeof json.mail === "string" ? json.mail : undefined,
  };
}

export async function getStoredOutlookCalendarConnection(
  appUserId: string
): Promise<OutlookCalendarConnection | null> {
  const cleanedAppUserId = String(appUserId || "").trim();
  if (!cleanedAppUserId) return null;

  const { data: integration, error: integrationError } = await supabaseAdmin
    .from("integrations")
    .select("id")
    .eq("app_user_id", cleanedAppUserId)
    .eq("integration_type", "calendar")
    .in("status", ["active", "connected"])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (integrationError) {
    throw new Error(integrationError.message);
  }

  if (!integration?.id) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("calendar_connections")
    .select(
      "id,integration_id,access_token,refresh_token,token_expires_at,provider,external_account_id"
    )
    .eq("integration_id", integration.id)
    .eq("provider", "outlook")
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const row = data as StoredOutlookConnectionRow | null;

  if (!row?.id || !row.access_token) {
    return null;
  }

  return {
    id: row.id,
    integration_id: row.integration_id,
    access_token: row.access_token,
    refresh_token: row.refresh_token,
    token_expires_at: row.token_expires_at,
    provider: row.provider,
    external_account_id: row.external_account_id,
  };
}

export async function getValidOutlookCalendarAccessToken(
  appUserId: string
): Promise<OutlookCalendarConnection> {
  const connection = await getStoredOutlookCalendarConnection(appUserId);

  if (!connection) {
    throw new Error("Outlook Calendar is not connected");
  }

  if (
    connection.access_token &&
    !isTokenExpiringSoon(connection.token_expires_at)
  ) {
    return connection;
  }

  if (!connection.refresh_token) {
    throw new Error("Missing Outlook refresh token");
  }

  const refreshed = await refreshOutlookCalendarToken(connection.refresh_token);
  const tokenExpiresAt = computeExpiresAt(refreshed.expires_in);

  const { error: updateError } = await supabaseAdmin
    .from("calendar_connections")
    .update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token ?? connection.refresh_token,
      token_expires_at: tokenExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connection.id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return {
    ...connection,
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token ?? connection.refresh_token,
    token_expires_at: tokenExpiresAt,
  };
}

export async function fetchOutlookCalendarEvents(params: {
  appUserId: string;
  timeMin: string;
  timeMax: string;
  timeZone?: string;
}): Promise<OutlookCalendarEventsResult> {
  const cleanedAppUserId = String(params.appUserId || "").trim();
  const timeMin = String(params.timeMin || "").trim();
  const timeMax = String(params.timeMax || "").trim();

  if (!cleanedAppUserId) {
    throw new Error("Missing app_user_id");
  }

  if (!timeMin || !timeMax) {
    throw new Error("Missing timeMin or timeMax");
  }

  const connection =
    await getValidOutlookCalendarAccessToken(cleanedAppUserId);

  const queryParams = new URLSearchParams({
    startDateTime: timeMin,
    endDateTime: timeMax,
    $select: "subject,start,end,showAs",
    $top: "250",
  });

  const response = await fetch(
    `${OUTLOOK_CALENDARVIEW_URL}?${queryParams.toString()}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${connection.access_token}`,
        Prefer: `outlook.timezone="UTC"`,
      },
      cache: "no-store",
    }
  );

  const json = (await response.json().catch(() => null)) as
    | {
        value?: OutlookCalendarEvent[];
        error?: {
          code?: string;
          message?: string;
        };
      }
    | null;

  if (!response.ok) {
    const message =
      json?.error?.message || "Failed to fetch Outlook Calendar events";
    throw new Error(message);
  }

  return {
    timeMin,
    timeMax,
    events: json?.value || [],
  };
}
