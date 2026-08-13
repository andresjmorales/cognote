/**
 * First-run teacher onboarding: signup provisioning guards, welcome
 * notification copy, and the short in-app tour.
 */

export function signupEmailRedirectTo(origin: string): string {
  return `${origin.replace(/\/$/, "")}/auth/confirm?next=/dashboard`;
}

export function shouldProvisionTeacherFromSignup(user: {
  identities?: unknown[] | null;
} | null | undefined): boolean {
  // Supabase returns a dummy user with empty identities when the email is
  // already registered (user-enumeration protection). Do not insert a
  // teachers row for that fake id.
  if (!user) return false;
  return Array.isArray(user.identities) && user.identities.length > 0;
}

export function isUniqueViolation(
  error: { code?: string } | null | undefined
): boolean {
  return error?.code === "23505";
}

/** Read a non-empty string from auth user_metadata. */
export function stringFromUserMetadata(
  metadata: unknown,
  key: string
): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const value = (metadata as Record<string, unknown>)[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export const WELCOME_NOTIFICATION = {
  type: "welcome" as const,
  title: "Welcome to CogNote!",
  body: "Add students, set your studio policy, and share a family portal when you are ready. Help in the account menu has the full guide.",
  href: "/help",
};

export type TourStep = {
  id: string;
  title: string;
  body: string;
  /** data-tour attribute to spotlight on desktop. */
  target?: string;
  /** Navigate here while this step is showing (layout stays mounted). */
  href?: string;
};

export const ONBOARDING_TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to CogNote",
    body: "This is a short look at the main tabs. Skip anytime. Help in the account menu has more detail.",
    href: "/dashboard",
  },
  {
    id: "students",
    title: "Students",
    body: "Add students by name. If you include an email or phone, or mark them as an adult student, a family is created so they get a portal link. You can also import a CSV or Excel file from Account settings.",
    target: "students",
    href: "/students",
  },
  {
    id: "families",
    title: "Families and portals",
    body: "Siblings share one family and one private portal link. Parents open that link with no login to see the schedule, practice links, notes, invoices, and a calendar feed. Reset the link from Families if it was shared too widely.",
    target: "families",
    href: "/families",
  },
  {
    id: "schedule",
    title: "Schedule",
    body: "Add weekly lesson times here. Tap a lesson to mark attendance or write a note. Make-ups use credits from cancellations, based on your studio policy. One-off lessons and recitals (Events tab) show on the week view too.",
    target: "schedule",
    href: "/schedule",
  },
  {
    id: "lessons",
    title: "Lessons and music",
    body: "Create practice assignments for note reading, key signatures, and symbols, then assign them so the family gets a practice link. The Music tab is for PDF or MusicXML scores; assign pieces and families can view them in the portal.",
    target: "lessons",
    href: "/lessons",
  },
  {
    id: "billing",
    title: "Billing and studio policy",
    body: "Set rates, lesson lengths, and cancellation rules under Studio, then generate invoices from attendance on Billing. Send a PDF, mark paid, or connect your own Stripe keys under Billing → Payment settings.",
    target: "billing",
    href: "/billing",
  },
  {
    id: "account",
    title: "Account settings",
    body: "Name, photo, timezone, notification preferences, CSV import, and data export live here. Dark mode is in this menu too. Open Help anytime for the full guide.",
    target: "account",
    href: "/account",
  },
];
