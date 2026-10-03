import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";
import { isUniqueViolation, WELCOME_NOTIFICATION } from "@/lib/onboarding";
import { getPolicy } from "@/lib/server/scheduling";
import { sendPushToTeacher } from "@/lib/server/push";
import type { StudioPolicy } from "@/lib/schedule";

export type NotificationType =
  | "portal_cancel"
  | "invoice_paid"
  | "event_rsvp"
  | "welcome";

export async function createTeacherNotification(
  supabase: SupabaseClient,
  args: {
    teacherId: string;
    type: NotificationType;
    title: string;
    body?: string;
    /** App-relative path, e.g. `/schedule` or `/billing/...` */
    href?: string | null;
    /** Absolute origin for email links (e.g. https://cognote.studio) */
    origin?: string | null;
    policy?: StudioPolicy;
  }
): Promise<{ emailed: boolean; emailError?: string }> {
  const policy = args.policy ?? (await getPolicy(supabase, args.teacherId));
  const href = args.href ?? null;
  // Both fields the push needs come from the same row: id tags the tray entry
  // (a re-delivery replaces its own notification instead of stacking a
  // duplicate), and created_at is the event time to stamp it with. Without a
  // row (bell off) both stay null — a payload with no timestamp already means
  // "now", so there is nothing to invent.
  let insertedRow: { id: string; created_at: string } | null = null;

  if (policy.notify_in_app) {
    const { data: inserted, error } = await supabase
      .from("notifications")
      .insert({
        teacher_id: args.teacherId,
        type: args.type,
        title: args.title,
        body: args.body ?? "",
        href,
      })
      .select("id, created_at")
      .single();
    if (error) {
      console.error("createTeacherNotification insert failed:", error.message);
    }
    insertedRow = inserted ?? null;
  }

  // Push is a second transport, not a function of the bell row, so it sits
  // beside the insert rather than inside it: a teacher who turns the bell off
  // should still get phone notifications. A brand-new teacher has no
  // subscription yet, so the "welcome" type is a natural no-op. Awaited rather
  // than fired and forgotten because on Vercel an unawaited promise can be
  // killed the moment the response returns, which would silently drop the
  // push; sendPushToTeacher never throws, so this cannot fail the caller.
  await sendPushToTeacher(supabase, args.teacherId, {
    id: insertedRow?.id ?? null,
    createdAt: insertedRow?.created_at ?? null,
    title: args.title,
    body: args.body,
    href,
  });

  const wantEmail =
    args.type === "portal_cancel"
      ? policy.notify_email_portal_cancel
      : args.type === "invoice_paid"
        ? policy.notify_email_invoice_paid
        : false;

  if (!wantEmail) return { emailed: false };

  const { data: teacher } = await supabase
    .from("teachers")
    .select("email, display_name")
    .eq("id", args.teacherId)
    .single();

  if (!teacher?.email) {
    return { emailed: false, emailError: "No teacher email on file" };
  }

  const studio = policy.studio_name || "CogNote Studio";
  const absoluteHref =
    href && args.origin
      ? `${args.origin.replace(/\/$/, "")}${href.startsWith("/") ? href : `/${href}`}`
      : href;

  // Invoice-paid emails read as a short receipt; other types stay title + body.
  const text =
    args.type === "invoice_paid"
      ? [
          "Payment receipt",
          "",
          args.body ?? args.title,
          absoluteHref ? `\nView invoice: ${absoluteHref}` : "",
          `\n${studio}`,
        ]
          .filter((line) => line !== undefined)
          .join("\n")
      : [
          args.title,
          args.body ? `\n${args.body}` : "",
          absoluteHref ? `\n\nOpen in CogNote: ${absoluteHref}` : "",
          `\n\n${studio}`,
        ].join("");

  const result = await sendEmail({
    to: teacher.email,
    subject: args.title,
    text,
    fromName: studio,
  });

  return { emailed: result.sent, emailError: result.error };
}

/** One unread "Welcome to CogNote!" bell item for brand-new teachers. */
export async function ensureWelcomeNotification(
  supabase: SupabaseClient,
  teacherId: string
): Promise<void> {
  const { data } = await supabase
    .from("notifications")
    .select("id")
    .eq("teacher_id", teacherId)
    .eq("type", "welcome")
    .maybeSingle();
  if (data) return;

  const { error } = await supabase.from("notifications").insert({
    teacher_id: teacherId,
    type: WELCOME_NOTIFICATION.type,
    title: WELCOME_NOTIFICATION.title,
    body: WELCOME_NOTIFICATION.body,
    href: WELCOME_NOTIFICATION.href,
  });
  if (error && !isUniqueViolation(error)) {
    console.error("ensureWelcomeNotification failed:", error.message);
  }
}
