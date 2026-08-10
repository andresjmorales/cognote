import type { SupabaseClient } from "@supabase/supabase-js";
import { hostedSignupFields } from "@/lib/entitlements";
import { ensureStudioPolicyRow } from "@/lib/server/ensure-policy";

/**
 * Ensure a teachers row (+ studio policy) exists for an auth user.
 * Uses the service client (authenticated role cannot INSERT teachers).
 * Hosted signups get trial fields from hostedSignupFields().
 */
export async function ensureTeacherForAuthUser(
  serviceClient: SupabaseClient,
  opts: {
    userId: string;
    email: string;
    displayName?: string | null;
    timezone?: string | null;
  }
): Promise<{ ok: true; created: boolean } | { ok: false; error: string }> {
  const { data: existing } = await serviceClient
    .from("teachers")
    .select("id")
    .eq("id", opts.userId)
    .maybeSingle();

  if (existing) {
    await ensureStudioPolicyRow(
      serviceClient,
      opts.userId,
      opts.timezone ?? null
    );
    return { ok: true, created: false };
  }

  const hosted = hostedSignupFields();
  const display =
    opts.displayName?.trim() ||
    opts.email.split("@")[0] ||
    "Teacher";

  const { error } = await serviceClient.from("teachers").insert({
    id: opts.userId,
    email: opts.email,
    display_name: display,
    hosted_plan: hosted.hosted_plan,
    trial_ends_at: hosted.trial_ends_at,
  });

  if (error) {
    console.error("Failed to create teacher row:", error);
    return { ok: false, error: "Failed to set up account" };
  }

  await ensureStudioPolicyRow(
    serviceClient,
    opts.userId,
    opts.timezone ?? null
  );
  return { ok: true, created: true };
}
