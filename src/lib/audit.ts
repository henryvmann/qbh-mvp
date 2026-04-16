import { supabaseAdmin } from "./supabase-server";

export async function logAudit(params: {
  appUserId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}): Promise<void> {
  try {
    await supabaseAdmin.from("audit_logs").insert({
      app_user_id: params.appUserId,
      action: params.action,
      resource_type: params.resourceType,
      resource_id: params.resourceId || null,
      details: params.details || null,
      ip_address: params.ipAddress || null,
    });
  } catch (err) {
    // Never block the main flow — log and move on
    console.error("[audit] Failed to write audit log:", err);
  }
}
