export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-server";
import {
  exchangeOutlookCalendarCode,
  fetchOutlookUserInfo,
  parseOutlookCalendarState,
} from "../../../../lib/outlook-calendar";

function dashboardHref(appUserId: string): string {
  return `/dashboard?user_id=${encodeURIComponent(appUserId)}`;
}

function calendarConnectHref(appUserId: string, message?: string): string {
  const params = new URLSearchParams();

  if (appUserId) {
    params.set("user_id", appUserId);
  }

  if (message) {
    params.set("calendar_error", message);
  }

  return `/calendar-connect?${params.toString()}`;
}

function computeExpiresAt(expiresIn?: number): string | null {
  if (!expiresIn || !Number.isFinite(expiresIn)) return null;
  return new Date(Date.now() + expiresIn * 1000).toISOString();
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

export async function GET(req: Request) {
  const url = new URL(req.url);

  try {
    const code = String(url.searchParams.get("code") || "").trim();
    const rawState = url.searchParams.get("state");
    const oauthError = String(url.searchParams.get("error") || "").trim();
    const oauthErrorDescription = String(
      url.searchParams.get("error_description") || ""
    ).trim();

    let appUserId = "";

    try {
      const parsed = parseOutlookCalendarState(rawState);
      appUserId = parsed.app_user_id;
    } catch {
      appUserId = "";
    }

    if (oauthError) {
      return NextResponse.redirect(
        new URL(
          calendarConnectHref(appUserId, oauthErrorDescription || oauthError),
          url.origin
        )
      );
    }

    if (!code || !rawState) {
      return NextResponse.redirect(
        new URL(
          calendarConnectHref(appUserId, "missing_code_or_state"),
          url.origin
        )
      );
    }

    const parsedState = parseOutlookCalendarState(rawState);
    await requireAppUser(parsedState.app_user_id);

    const token = await exchangeOutlookCalendarCode(code);
    const outlookUser = await fetchOutlookUserInfo(token.access_token);
    const tokenExpiresAt = computeExpiresAt(token.expires_in);
    const nowIso = new Date().toISOString();

    const { data: existingIntegration, error: existingIntegrationError } =
      await supabaseAdmin
        .from("integrations")
        .select("id")
        .eq("app_user_id", parsedState.app_user_id)
        .eq("integration_type", "calendar")
        .in("status", ["active", "connected"])
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

    if (existingIntegrationError) {
      return NextResponse.redirect(
        new URL(
          calendarConnectHref(
            parsedState.app_user_id,
            existingIntegrationError.message
          ),
          url.origin
        )
      );
    }

    let integrationId = existingIntegration?.id ?? null;

    if (!integrationId) {
      const { data: insertedIntegration, error: insertIntegrationError } =
        await supabaseAdmin
          .from("integrations")
          .insert({
            app_user_id: parsedState.app_user_id,
            integration_type: "calendar",
            status: "active",
          })
          .select("id")
          .single();

      if (insertIntegrationError || !insertedIntegration?.id) {
        return NextResponse.redirect(
          new URL(
            calendarConnectHref(
              parsedState.app_user_id,
              insertIntegrationError?.message ||
                "Failed to create calendar integration"
            ),
            url.origin
          )
        );
      }

      integrationId = insertedIntegration.id;
    } else {
      const { error: updateIntegrationError } = await supabaseAdmin
        .from("integrations")
        .update({
          status: "active",
          updated_at: nowIso,
        })
        .eq("id", integrationId);

      if (updateIntegrationError) {
        return NextResponse.redirect(
          new URL(
            calendarConnectHref(
              parsedState.app_user_id,
              updateIntegrationError.message
            ),
            url.origin
          )
        );
      }
    }

    // Check for existing Outlook connection on this integration
    const { data: existingConnection } = await supabaseAdmin
      .from("calendar_connections")
      .select("id")
      .eq("integration_id", integrationId)
      .eq("provider", "outlook")
      .limit(1)
      .maybeSingle();

    if (existingConnection?.id) {
      // Update existing Outlook connection
      const { error: updateError } = await supabaseAdmin
        .from("calendar_connections")
        .update({
          external_account_id: outlookUser.mail ?? outlookUser.id,
          access_token: token.access_token ?? null,
          refresh_token: token.refresh_token ?? null,
          token_expires_at: tokenExpiresAt,
          updated_at: nowIso,
        })
        .eq("id", existingConnection.id);

      if (updateError) {
        return NextResponse.redirect(
          new URL(
            calendarConnectHref(parsedState.app_user_id, updateError.message),
            url.origin
          )
        );
      }
    } else {
      // Insert new Outlook connection
      const { error: insertError } = await supabaseAdmin
        .from("calendar_connections")
        .insert({
          integration_id: integrationId,
          provider: "outlook",
          external_account_id: outlookUser.mail ?? outlookUser.id,
          access_token: token.access_token ?? null,
          refresh_token: token.refresh_token ?? null,
          token_expires_at: tokenExpiresAt,
          updated_at: nowIso,
        });

      if (insertError) {
        return NextResponse.redirect(
          new URL(
            calendarConnectHref(parsedState.app_user_id, insertError.message),
            url.origin
          )
        );
      }
    }

    return NextResponse.redirect(
      new URL(dashboardHref(parsedState.app_user_id), url.origin)
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "outlook_calendar_callback_failed";

    let appUserId = "";

    try {
      const parsed = parseOutlookCalendarState(url.searchParams.get("state"));
      appUserId = parsed.app_user_id;
    } catch {
      appUserId = "";
    }

    return NextResponse.redirect(
      new URL(calendarConnectHref(appUserId, message), url.origin)
    );
  }
}
