import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * Generate a URL-safe token for practice and portal links.
 * 16 random bytes (128 bits) -> 22 base64url chars. Stored in DB; lookup is
 * by token, no decryption needed. Tokens issued before August 2026 were 8
 * chars and remain valid; brute-force protection for those relies on the
 * lookup rate limits in lib/rateLimit.ts.
 */
export function generateShortToken(): string {
  return randomBytes(16).toString("base64url");
}

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

interface TokenPayload {
  studentId: string;
  planId: string;
  teacherId: string;
}

function getKey(): Buffer {
  const hex = process.env.TOKEN_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)"
    );
  }
  return Buffer.from(hex, "hex");
}

function base64urlEncode(buf: Buffer): string {
  return buf.toString("base64url");
}

function base64urlDecode(str: string): Buffer {
  return Buffer.from(str, "base64url");
}

export function encryptToken(payload: TokenPayload): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const plaintext = JSON.stringify(payload);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // iv + authTag + ciphertext → single base64url string
  return base64urlEncode(Buffer.concat([iv, authTag, encrypted]));
}

/**
 * At-rest encryption for per-teacher secrets (BYO Stripe keys, AI API keys)
 * stored in studio_policies. Values are prefixed so legacy plaintext rows
 * keep working: reads pass unprefixed values through unchanged and re-save
 * encrypts them.
 */
const SECRET_PREFIX = "enc.v1.";

export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return SECRET_PREFIX + base64urlEncode(Buffer.concat([iv, authTag, encrypted]));
}

/**
 * Decrypt a stored secret. Unprefixed values (rows written before encryption
 * shipped) are returned as-is. Returns null when decryption fails (for
 * example after a TOKEN_ENCRYPTION_KEY rotation) so callers degrade to
 * "not configured" instead of crashing.
 */
export function decryptSecret(stored: string | null): string | null {
  if (!stored || !stored.startsWith(SECRET_PREFIX)) return stored;
  try {
    const raw = base64urlDecode(stored.slice(SECRET_PREFIX.length));
    const iv = raw.subarray(0, IV_LENGTH);
    const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = createDecipheriv(ALGORITHM, getKey(), iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch (err) {
    console.error("Failed to decrypt stored secret (key rotated?):", err);
    return null;
  }
}

export function decryptToken(token: string): TokenPayload {
  const key = getKey();
  const raw = base64urlDecode(token);

  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString("utf8")) as TokenPayload;
}
