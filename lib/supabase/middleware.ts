import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { requestOrigin } from "@/lib/server/http";
import { AUTH_REQUEST_TIMEOUT_MS, withTimeout } from "@/lib/auth-errors";
import { resolveSessionGate } from "@/lib/auth-session";
import { serverPublicConfig } from "@/lib/runtime-config";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const { supabaseUrl, supabaseAnonKey } = serverPublicConfig();

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
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
    const url = new URL(requestOrigin(request));
    url.pathname = decision === "login" ? "/login" : "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
