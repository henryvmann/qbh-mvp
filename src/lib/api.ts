import { Capacitor } from '@capacitor/core';
import { createClient } from './supabase/client';

const VERCEL_URL = 'https://qbh-mvp.vercel.app';

/**
 * Thin fetch wrapper for all internal API calls.
 * - Prefixes the Vercel URL when running in the native app
 * - Injects the Supabase bearer token when running in the native app
 * - On web, path is relative and no auth header is added (cookies handle it)
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
  // Always try to get the Bearer token — cookies alone may not work
  // immediately after sign-in due to async cookie propagation
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      return { Authorization: `Bearer ${session.access_token}` };
    }
  } catch {
    // Fall through to no auth headers — cookies will handle it
  }
  return {};
}
