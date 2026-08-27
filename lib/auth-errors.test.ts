import { describe, expect, it } from "vitest";
import {
  authFormErrorFromUnknown,
  authReachabilityDetail,
  isAuthUnreachableMessage,
  isLocalHostname,
  withTimeout,
} from "./auth-errors";

describe("isAuthUnreachableMessage", () => {
  it("matches browser network failures", () => {
    expect(isAuthUnreachableMessage("Failed to fetch")).toBe(true);
    expect(isAuthUnreachableMessage("NetworkError when attempting to fetch resource.")).toBe(
      true
    );
    expect(isAuthUnreachableMessage("fetch failed")).toBe(true);
    expect(isAuthUnreachableMessage("Load failed")).toBe(true);
    expect(isAuthUnreachableMessage("Auth service timed out")).toBe(true);
    expect(isAuthUnreachableMessage("The user aborted a request")).toBe(true);
  });

  it("leaves credential errors alone", () => {
    expect(isAuthUnreachableMessage("Invalid login credentials")).toBe(false);
    expect(isAuthUnreachableMessage("Email not confirmed")).toBe(false);
  });
});

describe("isLocalHostname", () => {
  it("treats loopback as local", () => {
    expect(isLocalHostname("localhost")).toBe(true);
    expect(isLocalHostname("127.0.0.1")).toBe(true);
    expect(isLocalHostname("cognote.studio")).toBe(false);
  });
});

describe("authFormErrorFromUnknown", () => {
  it("uses a short headline and expandable detail for network failures", () => {
    expect(
      authFormErrorFromUnknown(new Error("Failed to fetch"), { isLocal: false })
    ).toEqual({
      headline: "Can't sign in right now",
      detail: authReachabilityDetail(false),
    });
  });

  it("keeps local Docker instructions out of production detail", () => {
    const production = authFormErrorFromUnknown(new Error("Failed to fetch"), {
      isLocal: false,
    });
    const local = authFormErrorFromUnknown(new Error("Failed to fetch"), {
      isLocal: true,
    });
    expect(production.detail).not.toMatch(/Docker/);
    expect(local.detail).toMatch(/npx supabase start/);
  });

  it("varies the headline by form action", () => {
    expect(
      authFormErrorFromUnknown(new Error("Failed to fetch"), { action: "signup" })
        .headline
    ).toBe("Can't create your account right now");
  });

  it("keeps email-confirmation copy as the headline", () => {
    expect(
      authFormErrorFromUnknown(new Error("Email not confirmed")).headline
    ).toMatch(/confirmation link/);
  });

  it("passes through short auth API messages", () => {
    expect(
      authFormErrorFromUnknown(new Error("Invalid login credentials"))
    ).toEqual({ headline: "Invalid login credentials" });
  });
});

describe("withTimeout", () => {
  it("resolves when the promise finishes in time", async () => {
    await expect(withTimeout(Promise.resolve(7), 50)).resolves.toBe(7);
  });

  it("rejects when the promise hangs", async () => {
    await expect(
      withTimeout(new Promise(() => {}), 20, "Auth service timed out")
    ).rejects.toThrow("Auth service timed out");
  });
});
