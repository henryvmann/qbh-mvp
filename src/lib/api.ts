import { Capacitor } from '@capacitor/core';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const VERCEL_URL = 'https://qbh-mvp.vercel.app';

// Singleton Supabase client for auth — persists session in localStorage
let _supabase: ReturnType<typeof createSupabaseClient> | null = null;
export function getAuthClient() {
  if (typeof window === "undefined") return null;
  if (!_supabase) {
    _supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return _supabase;
}

/**
 * Thin fetch wrapper for all internal API calls.
 * Always sends Bearer token from Supabase session (localStorage-based).
 */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const baseUrl = Capacitor.isNativePlatform() ? VERCEL_URL : '';
  const authHeaders = await getAuthHeaders();
  const headers: Record<string, string> = {
    ...authHeaders,
    ...(init?.headers as Record<string, string> ?? {}),
  };
  return fetch(baseUrl + path, { ...init, headers, credentials: 'same-origin' });
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const supabase = getAuthClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      return { Authorization: `Bearer ${session.access_token}` };
    }
  } catch {
    // No session available
  }
  return {};
}
