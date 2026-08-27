import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { AUTH_REQUEST_TIMEOUT_MS, withTimeout } from "@/lib/auth-errors";
import { resolveSessionGate } from "@/lib/auth-session";

export async function updateSession(request: NextRequest) {
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

  let hasUser = false;
  let authUnreachable = false;
  try {
    const {
      data: { user },
    } = await withTimeout(
      supabase.auth.getUser(),
      AUTH_REQUEST_TIMEOUT_MS,
      "Auth service timed out"
    );
    hasUser = Boolean(user);
  } catch {
    authUnreachable = true;
  }

  const decision = resolveSessionGate({
    pathname: request.nextUrl.pathname,
    hasUser,
    authUnreachable,
  });

  if (decision === "login" || decision === "dashboard") {
    const url = request.nextUrl.clone();
    url.pathname = decision === "login" ? "/login" : "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
