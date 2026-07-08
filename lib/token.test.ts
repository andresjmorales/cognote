import { describe, it, expect, beforeEach, vi } from "vitest";
import { generateShortToken, encryptToken, decryptToken } from "@/lib/token";

const TEST_KEY = "a".repeat(64); // 32 bytes of 0xaa

const payload = {
  studentId: "10000000-0000-0000-0000-000000000001",
  planId: "20000000-0000-0000-0000-000000000001",
  teacherId: "00000000-0000-0000-0000-000000000001",
};

beforeEach(() => {
  vi.unstubAllEnvs();
});

describe("generateShortToken", () => {
  it("produces 8-char URL-safe tokens", () => {
    for (let i = 0; i < 100; i++) {
      expect(generateShortToken()).toMatch(/^[A-Za-z0-9_-]{8}$/);
    }
  });

  it("does not collide across many generations", () => {
    const tokens = new Set(Array.from({ length: 10_000 }, generateShortToken));
    expect(tokens.size).toBe(10_000);
  });
});

describe("encryptToken / decryptToken", () => {
  it("round-trips a payload", () => {
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", TEST_KEY);
    expect(decryptToken(encryptToken(payload))).toEqual(payload);
  });

  it("produces a different token each time (random IV)", () => {
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", TEST_KEY);
    expect(encryptToken(payload)).not.toBe(encryptToken(payload));
  });

  it("emits URL-safe tokens", () => {
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", TEST_KEY);
    expect(encryptToken(payload)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("rejects tampered tokens (GCM auth)", () => {
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", TEST_KEY);
    const token = encryptToken(payload);
    // Flip one ciphertext bit in the decoded bytes. (Mutating the base64url
    // string instead is flaky: the final character carries padding bits that
    // decode to nothing, so a character swap can leave the bytes unchanged.)
    const raw = Buffer.from(token, "base64url");
    raw[raw.length - 1] ^= 0x01;
    expect(() => decryptToken(raw.toString("base64url"))).toThrow();
  });

  it("rejects a tampered auth tag", () => {
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", TEST_KEY);
    const token = encryptToken(payload);
    const raw = Buffer.from(token, "base64url");
    raw[12] ^= 0x01; // first auth-tag byte (after the 12-byte IV)
    expect(() => decryptToken(raw.toString("base64url"))).toThrow();
  });

  it("rejects tokens encrypted with a different key", () => {
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", TEST_KEY);
    const token = encryptToken(payload);
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", "b".repeat(64));
    expect(() => decryptToken(token)).toThrow();
  });

  it("throws a clear error when the key is missing or malformed", () => {
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", "");
    expect(() => encryptToken(payload)).toThrow(/TOKEN_ENCRYPTION_KEY/);
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", "too-short");
    expect(() => encryptToken(payload)).toThrow(/64-char hex/);
  });
});
