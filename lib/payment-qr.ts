/**
 * Payment QR codes (PayNow, UPI, PIX, Venmo, etc.) uploaded in payment
 * settings. Stored as a small base64 data URL on `studio_policies` and
 * rendered on invoices and the family portal for manual payments.
 */

export const PAYMENT_QR_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

/** Upload guard before client-side downscaling. */
export const PAYMENT_QR_MAX_INPUT_BYTES = 8 * 1024 * 1024;

/** Longest edge after downscaling; plenty for a scannable QR. */
export const PAYMENT_QR_MAX_DIMENSION = 600;

/** Must match the CHECK constraint on studio_policies.payment_qr_code. */
export const PAYMENT_QR_MAX_DATA_URL_LENGTH = 400_000;

const DATA_URL_RE = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+=*)$/;

export type PaymentQrFormat = "png" | "jpeg";

export interface DecodedPaymentQr {
  format: PaymentQrFormat;
  bytes: Uint8Array;
}

/**
 * Decode a stored payment QR data URL. Returns null for anything that isn't
 * a size-capped PNG/JPEG whose bytes match its declared type, so callers can
 * safely skip rendering bad or legacy values.
 */
export function decodePaymentQrDataUrl(
  value: string | null | undefined
): DecodedPaymentQr | null {
  if (!value || value.length > PAYMENT_QR_MAX_DATA_URL_LENGTH) return null;
  const match = DATA_URL_RE.exec(value);
  if (!match) return null;
  const format = match[1] as PaymentQrFormat;
  let binary: string;
  try {
    binary = atob(match[2]);
  } catch {
    return null;
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const isPng =
    bytes.length > 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47;
  const isJpeg =
    bytes.length > 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff;
  if (format === "png" ? !isPng : !isJpeg) return null;

  return { format, bytes };
}

export function isValidPaymentQrDataUrl(
  value: string | null | undefined
): value is string {
  return decodePaymentQrDataUrl(value) !== null;
}
