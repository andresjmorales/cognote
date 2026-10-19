import { createServerClient } from "@supabase/ssr";
import { createClient as createJsClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { serverPublicConfig } from "@/lib/runtime-config";

export async function createClient() {
  const cookieStore = await cookies();
  const { supabaseUrl, supabaseAnonKey } = serverPublicConfig();

  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll is called from a Server Component — ignore
          }
        },
      },
    }
  );
}

export function createServiceClient() {
  return createJsClient(
    serverPublicConfig().supabaseUrl,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
