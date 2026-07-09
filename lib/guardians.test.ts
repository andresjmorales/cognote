import { describe, it, expect } from "vitest";
import { familyEmailRecipients, familyGreetingNames } from "@/lib/guardians";

const base = {
  name: "Jordan",
  email: "jordan@example.com",
  secondary_name: "Sam",
  secondary_email: "sam@example.com",
  secondary_phone: null,
  email_recipients: "primary" as const,
};

describe("familyEmailRecipients", () => {
  it("defaults to the primary guardian", () => {
    expect(familyEmailRecipients(base)).toEqual(["jordan@example.com"]);
  });

  it("sends to the secondary guardian when preferred", () => {
    expect(
      familyEmailRecipients({ ...base, email_recipients: "secondary" })
    ).toEqual(["sam@example.com"]);
  });

  it("sends to both when preferred", () => {
    expect(familyEmailRecipients({ ...base, email_recipients: "both" })).toEqual([
      "jordan@example.com",
      "sam@example.com",
    ]);
  });

  it("falls back to the other guardian when the preferred one has no email", () => {
    expect(
      familyEmailRecipients({ ...base, email: null })
    ).toEqual(["sam@example.com"]);
    expect(
      familyEmailRecipients({
        ...base,
        secondary_email: null,
        email_recipients: "secondary",
      })
    ).toEqual(["jordan@example.com"]);
  });

  it("skips missing emails in 'both' mode without duplicating", () => {
    expect(
      familyEmailRecipients({ ...base, secondary_email: "  ", email_recipients: "both" })
    ).toEqual(["jordan@example.com"]);
  });

  it("returns empty when no emails exist at all", () => {
    expect(
      familyEmailRecipients({ ...base, email: null, secondary_email: null })
    ).toEqual([]);
  });

  it("treats a missing preference as primary", () => {
    expect(
      familyEmailRecipients({ ...base, email_recipients: undefined })
    ).toEqual(["jordan@example.com"]);
  });
});

describe("familyGreetingNames", () => {
  it("greets the primary guardian by default", () => {
    expect(familyGreetingNames(base)).toBe("Jordan");
  });

  it("greets both when both receive the email", () => {
    expect(familyGreetingNames({ ...base, email_recipients: "both" })).toBe(
      "Jordan and Sam"
    );
  });

  it("greets the secondary guardian when only they receive it", () => {
    expect(familyGreetingNames({ ...base, email_recipients: "secondary" })).toBe(
      "Sam"
    );
  });

  it("falls back to the primary name when nobody has an email", () => {
    expect(
      familyGreetingNames({ ...base, email: null, secondary_email: null })
    ).toBe("Jordan");
  });
});
