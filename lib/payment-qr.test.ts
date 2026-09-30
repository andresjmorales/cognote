import { describe, it, expect } from "vitest";
import {
  PAYMENT_QR_MAX_DATA_URL_LENGTH,
  decodePaymentQrDataUrl,
  isValidPaymentQrDataUrl,
} from "@/lib/payment-qr";

// 1x1 transparent PNG
const PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const PNG_URL = `data:image/png;base64,${PNG_B64}`;

describe("decodePaymentQrDataUrl", () => {
  it("decodes a PNG data URL", () => {
    const qr = decodePaymentQrDataUrl(PNG_URL);
    expect(qr?.format).toBe("png");
    expect(qr?.bytes[0]).toBe(0x89);
  });

  it("decodes a JPEG data URL with JPEG magic bytes", () => {
    const jpegB64 = btoa(String.fromCharCode(0xff, 0xd8, 0xff, 0xe0, 0, 0x10));
    expect(decodePaymentQrDataUrl(`data:image/jpeg;base64,${jpegB64}`)?.format).toBe(
      "jpeg"
    );
  });

  it("rejects empty and non-image values", () => {
    expect(decodePaymentQrDataUrl(null)).toBeNull();
    expect(decodePaymentQrDataUrl("")).toBeNull();
    expect(decodePaymentQrDataUrl("https://example.com/qr.png")).toBeNull();
    expect(decodePaymentQrDataUrl("javascript:alert(1)")).toBeNull();
    expect(
      decodePaymentQrDataUrl(`data:image/svg+xml;base64,${PNG_B64}`)
    ).toBeNull();
  });

  it("rejects bytes that don't match the declared type", () => {
    expect(decodePaymentQrDataUrl(`data:image/jpeg;base64,${PNG_B64}`)).toBeNull();
    expect(decodePaymentQrDataUrl(`data:image/png;base64,${btoa("hello world")}`)).toBeNull();
  });

  it("rejects oversized values", () => {
    const big = `${PNG_URL}${"A".repeat(PAYMENT_QR_MAX_DATA_URL_LENGTH)}`;
    expect(isValidPaymentQrDataUrl(big)).toBe(false);
  });
});
