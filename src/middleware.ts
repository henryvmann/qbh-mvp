import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Pages that do not require authentication.
// Everything else redirects to /login if unauthenticated.
// /connect and /plaid/oauth are pre-auth onboarding — no session exists yet
const PUBLIC_PATHS = ["/", "/login", "/start", "/auth", "/connect", "/plaid/oauth"];

function checkBasicAuth(request: NextRequest): NextResponse | null {
  const users: Record<string, string> = {
    henry: process.env.SITE_PASSWORD_HENRY ?? "",
    jenny: process.env.SITE_PASSWORD_JENNY ?? "",
  };

  const authHeader = request.headers.get("authorization");

  if (authHeader?.startsWith("Basic ")) {
    const base64 = authHeader.slice(6);
    const decoded = atob(base64);
    const colon = decoded.indexOf(":");
    const username = decoded.slice(0, colon).toLowerCase();
    const password = decoded.slice(colon + 1);

    if (users[username] && users[username] === password) {
      return null; // valid — let through
    }
  }

  return new NextResponse("Unauthorized", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Quarterback Health"',
    },
  });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Apply Basic Auth to all web pages (skip API routes — native app uses those)
  if (!pathname.startsWith("/api/")) {
    const authResult = checkBasicAuth(request);
    if (authResult) return authResult;
  }

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  if (isPublic) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

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

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  // Run on all pages; skip Next.js internals and API routes.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
