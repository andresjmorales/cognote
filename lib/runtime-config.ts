/**
 * Public configuration read at RUNTIME, so one published Docker image works
 * against any Supabase.
 *
 * Next inlines every literal `process.env.NEXT_PUBLIC_*` expression at build
 * time — on the server as well as in the client bundle. An image built in CI
 * would otherwise carry whatever (or nothing) was set during that build.
 *
 * - Server: env is read through an alias, which the bundler does not inline.
 * - Browser: `/runtime-config.js` (app/runtime-config.js/route.ts) sets
 *   `window.__COGNOTE_CONFIG__` before hydration, via a beforeInteractive
 *   script in the root layout. The build-time value remains the fallback, so a
 *   deployment that bakes the values (Vercel) behaves exactly as before.
 *
 * Only values that are safe in the browser belong here: the anon key is public
 * by design (RLS is what protects data).
 */

export type PublicConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

declare global {
  interface Window {
    __COGNOTE_CONFIG__?: Partial<PublicConfig>;
  }
}

export const RUNTIME_CONFIG_PATH = "/runtime-config.js";

/** Read through an alias so Next's build-time inlining does not apply. */
function runtimeEnv(): Record<string, string | undefined> {
  return typeof process === "undefined" ? {} : process.env;
}

/** The server's view, read per call from the environment. */
export function serverPublicConfig(
  env: Record<string, string | undefined> = runtimeEnv()
): PublicConfig {
  return {
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "",
    supabaseAnonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "",
  };
}

/**
 * Supabase URL + anon key for whichever side this runs on. Server: runtime
 * env, then the build-time value. Browser: the injected config, then the
 * build-time value.
 */
export function publicConfig(): PublicConfig {
  const injected =
    typeof window === "undefined"
      ? serverPublicConfig()
      : window.__COGNOTE_CONFIG__;
  return {
    supabaseUrl:
      injected?.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    supabaseAnonKey:
      injected?.supabaseAnonKey ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "",
  };
}

/** Body of /runtime-config.js. JSON is a valid JS expression; `<` is escaped defensively. */
export function runtimeConfigScript(config: PublicConfig): string {
  const json = JSON.stringify(config).replace(/</g, "\\u003c");
  return `window.__COGNOTE_CONFIG__=${json};\n`;
}
