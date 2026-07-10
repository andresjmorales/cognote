import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";
import { getPolicy } from "@/lib/server/scheduling";
import type { StudioPolicy } from "@/lib/schedule";

export type NotificationType = "portal_cancel" | "invoice_paid";

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

  if (policy.notify_in_app) {
    const { error } = await supabase.from("notifications").insert({
      teacher_id: args.teacherId,
      type: args.type,
      title: args.title,
      body: args.body ?? "",
      href,
    });
    if (error) {
      console.error("createTeacherNotification insert failed:", error.message);
    }
  }

  const wantEmail =
    args.type === "portal_cancel"
      ? policy.notify_email_portal_cancel
      : policy.notify_email_invoice_paid;

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
  const text = [
    args.title,
    args.body ? `\n${args.body}` : "",
    absoluteHref ? `\n\nOpen in CogNote: ${absoluteHref}` : "",
    `\n\n— ${studio}`,
  ].join("");

  const result = await sendEmail({
    to: teacher.email,
    subject: args.title,
    text,
    fromName: studio,
  });

  return { emailed: result.sent, emailError: result.error };
}
