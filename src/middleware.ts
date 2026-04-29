import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Pages that do not require authentication.
// Everything else redirects to /login if unauthenticated.
// All paths are effectively public — auth is handled client-side via Bearer tokens.
// The proxy only refreshes session cookies; it no longer redirects.
const PUBLIC_PATHS = [
  "/", "/login", "/start", "/auth", "/connect", "/plaid/oauth", "/onboarding",
  "/handle-first", "/dashboard", "/providers", "/visits", "/goals", "/timeline",
  "/notes", "/calendar-view", "/calendar-connect", "/settings", "/account",
  "/medications", "/recordings", "/analytics", "/admin", "/portal-connect", "/care-recipients",
  "/billing", "/privacy", "/terms", "/dashboard-v2", "/dashboard-v3", "/documents", "/onboarding-v2", "/health-card",
  "/providers-hub-a", "/providers-hub-c", "/providers-hub-c1", "/providers-hub-c2", "/providers-hub-c3", "/call-test",
  "/call-test/results",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  let supabaseResponse = NextResponse.next({ request });

  // Always refresh the session to keep cookies alive — even on public paths.
  // Without this, post-signup navigations lose the auth session.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Only enforce auth redirect on non-public paths
  if (!isPublic && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  // Run on all pages; skip Next.js internals, API routes, and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)"],
};
