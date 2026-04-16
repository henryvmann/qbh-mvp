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
  return fetch(baseUrl + path, { ...init, headers, credentials: 'include' });
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  if (!Capacitor.isNativePlatform()) return {};
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return {};
  return { Authorization: `Bearer ${session.access_token}` };
}

// Re-export for components that need the auth client directly
export { createClient as getAuthClient } from './supabase/client';
