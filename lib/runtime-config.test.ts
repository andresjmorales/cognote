import { describe, expect, it } from "vitest";
import { runtimeConfigScript, serverPublicConfig } from "./runtime-config";

describe("serverPublicConfig", () => {
  it("reads the Supabase URL and anon key from the given env", () => {
    expect(
      serverPublicConfig({
        NEXT_PUBLIC_SUPABASE_URL: " http://supabase.localhost:8000 ",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      })
    ).toEqual({ supabaseUrl: "http://supabase.localhost:8000", supabaseAnonKey: "anon" });
  });

  it("returns empty strings when unset", () => {
    expect(serverPublicConfig({})).toEqual({ supabaseUrl: "", supabaseAnonKey: "" });
  });
});

describe("runtimeConfigScript", () => {
  it("assigns the config to window as a JSON literal", () => {
    const script = runtimeConfigScript({ supabaseUrl: "https://x.supabase.co", supabaseAnonKey: "k" });
    expect(script).toBe(
      'window.__COGNOTE_CONFIG__={"supabaseUrl":"https://x.supabase.co","supabaseAnonKey":"k"};\n'
    );
  });

  it("escapes < so a value cannot close a surrounding script tag", () => {
    const script = runtimeConfigScript({ supabaseUrl: "</script>", supabaseAnonKey: "" });
    expect(script).not.toContain("</script>");
    const parsed = JSON.parse(script.slice("window.__COGNOTE_CONFIG__=".length, -2));
    expect(parsed.supabaseUrl).toBe("</script>");
  });
});
