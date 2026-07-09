import type { EmailRecipients } from "@/lib/supabase/types";

/**
 * The contact fields a family (guardians row) carries. A family has a
 * primary guardian and an optional second guardian; email_recipients
 * controls who receives family emails.
 */
export interface FamilyContact {
  name: string;
  email: string | null;
  secondary_name?: string | null;
  secondary_email?: string | null;
  email_recipients?: EmailRecipients | null;
}

/**
 * Display name for a family: the explicit family name when set, otherwise
 * the primary guardian's name (pre-family_name behavior).
 */
export function familyDisplayName(family: {
  family_name?: string | null;
  name: string;
}): string {
  return family.family_name?.trim() || family.name;
}

/**
 * Resolve the email addresses a family email should go to, honoring the
 * family's email_recipients setting. Guardians without an email on file are
 * skipped; if the preferred guardian has no email we fall back to the other
 * one rather than silently dropping the message.
 */
export function familyEmailRecipients(family: FamilyContact): string[] {
  const primary = family.email?.trim() || null;
  const secondary = family.secondary_email?.trim() || null;
  const preference = family.email_recipients ?? "primary";

  switch (preference) {
    case "both":
      return [primary, secondary].filter((e): e is string => !!e);
    case "secondary":
      return secondary ? [secondary] : primary ? [primary] : [];
    case "primary":
    default:
      return primary ? [primary] : secondary ? [secondary] : [];
  }
}

/**
 * Greeting name(s) matching the recipients: "Jordan" or "Jordan and Sam".
 * Falls back to the primary guardian's name.
 */
export function familyGreetingNames(family: FamilyContact): string {
  const recipients = familyEmailRecipients(family);
  const names: string[] = [];
  if (recipients.includes(family.email?.trim() ?? "")) names.push(family.name);
  if (
    family.secondary_name &&
    recipients.includes(family.secondary_email?.trim() ?? "")
  ) {
    names.push(family.secondary_name);
  }
  if (names.length === 0) return family.name;
  return names.join(" and ");
}
