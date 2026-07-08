import { describe, it, expect, beforeEach, vi } from "vitest";
import { fromHeader, withPortalFooter, sendEmail } from "@/lib/email";

beforeEach(() => {
  vi.unstubAllEnvs();
});

describe("fromHeader", () => {
  it("uses the default platform address and name", () => {
    vi.stubEnv("EMAIL_FROM_ADDRESS", undefined);
    expect(fromHeader()).toBe('"CogNote Studio" <notifications@cognote.studio>');
  });

  it("uses EMAIL_FROM_ADDRESS when configured", () => {
    vi.stubEnv("EMAIL_FROM_ADDRESS", "hello@example.com");
    expect(fromHeader("My Studio")).toBe('"My Studio" <hello@example.com>');
  });

  it("renders the per-teacher display name", () => {
    expect(fromHeader("Morales Piano Studio (via CogNote)")).toContain(
      '"Morales Piano Studio (via CogNote)"'
    );
  });

  it("strips characters that would break or spoof the header", () => {
    vi.stubEnv("EMAIL_FROM_ADDRESS", undefined);
    expect(fromHeader('Evil" <fake@spoof.com>\r\nBcc: x')).toBe(
      '"Evil <fake@spoof.com>Bcc: x" <notifications@cognote.studio>'
    );
  });

  it("falls back to the default name for blank input", () => {
    expect(fromHeader("   ")).toContain('"CogNote Studio"');
  });
});

describe("withPortalFooter", () => {
  const base = {
    to: "parent@example.com",
    subject: "Hi",
    text: "Notes from today's lesson.",
  };

  it("leaves the email untouched without a portalUrl", () => {
    expect(withPortalFooter(base)).toEqual(base);
  });

  it("appends the portal link to the text body", () => {
    const out = withPortalFooter({ ...base, portalUrl: "https://app.test/portal/abc" });
    expect(out.text).toContain("Notes from today's lesson.");
    expect(out.text).toContain("Your family portal");
    expect(out.text).toContain("https://app.test/portal/abc");
  });

  it("generates an HTML body from the text when none exists", () => {
    const out = withPortalFooter({ ...base, portalUrl: "https://app.test/portal/abc" });
    expect(out.html).toContain("Notes from today's lesson.");
    expect(out.html).toContain('<a href="https://app.test/portal/abc">');
  });

  it("escapes HTML in the text when generating the HTML body", () => {
    const out = withPortalFooter({
      ...base,
      text: "Practice <b>loud</b> & clear",
      portalUrl: "https://app.test/portal/abc",
    });
    expect(out.html).toContain("Practice &lt;b&gt;loud&lt;/b&gt; &amp; clear");
    expect(out.html).not.toContain("<b>loud</b>");
  });

  it("preserves an existing HTML body and appends the footer to it", () => {
    const out = withPortalFooter({
      ...base,
      html: "<p>Custom body</p>",
      portalUrl: "https://app.test/portal/abc",
    });
    expect(out.html).toContain("<p>Custom body</p>");
    expect(out.html).toContain("https://app.test/portal/abc");
  });
});

describe("sendEmail provider selection", () => {
  it("no-ops gracefully when EMAIL_PROVIDER is unset", async () => {
    vi.stubEnv("EMAIL_PROVIDER", "");
    const result = await sendEmail({
      to: "parent@example.com",
      subject: "Hi",
      text: "Body",
    });
    expect(result.sent).toBe(false);
    expect(result.error).toBe("Email is not configured");
  });

  it("fails cleanly when resend is selected without an API key", async () => {
    vi.stubEnv("EMAIL_PROVIDER", "resend");
    vi.stubEnv("RESEND_API_KEY", "");
    const result = await sendEmail({
      to: "parent@example.com",
      subject: "Hi",
      text: "Body",
    });
    expect(result.sent).toBe(false);
    expect(result.error).toContain("RESEND_API_KEY");
  });
});
