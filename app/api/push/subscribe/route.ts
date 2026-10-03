import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseBody } from "@/lib/server/api-schemas";
import { isAllowedPushEndpoint, isPushSubscribeConflict } from "@/lib/push";

export const runtime = "nodejs";

/** Mirrors PushSubscription.toJSON(); the endpoint is a URL to a push service. */
const subscribeSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(256),
    auth: z.string().min(1).max(256),
  }),
});

/** Register this device. Idempotent: re-subscribing refreshes the keys in place. */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = parseBody(subscribeSchema, await req.json().catch(() => ({})));
  if (!parsed.ok) return parsed.response;
  const { endpoint, keys } = parsed.data;

  // A push endpoint is always HTTPS and always belongs to a known push service.
  // The URL is later POSTed to by the sender, so an unrecognised host is an SSRF
  // surface — see isAllowedPushEndpoint.
  const extraHosts = (process.env.PUSH_ENDPOINT_HOSTS_EXTRA ?? "")
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean);
  if (!isAllowedPushEndpoint(endpoint, extraHosts)) {
    return NextResponse.json(
      { error: "endpoint must be a known push service" },
      { status: 400 }
    );
  }

  // The endpoint is unique per device+registration, so a re-subscribe refreshes
  // the keys in place instead of accumulating rows.
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      teacher_id: user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      user_agent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    // Logged, not returned: Postgres messages name relations and policies.
    console.error("push subscribe failed:", error.message);
    // The endpoint already belongs to another teacher. RLS hides their row, so
    // the upsert's ON CONFLICT can never fire and Postgres reports a policy
    // violation (42501) rather than a unique violation. 409 tells the client to
    // retire this browser's subscription and retry with a fresh endpoint.
    if (isPushSubscribeConflict(error.code)) {
      return NextResponse.json(
        { error: "This device is registered to another account." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Could not save this device." },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}

/** Remove this device. Body: { endpoint }. Other devices are untouched. */
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  if (typeof body.endpoint !== "string" || !body.endpoint) {
    return NextResponse.json({ error: "endpoint required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("teacher_id", user.id)
    .eq("endpoint", body.endpoint);

  if (error) {
    // Logged, not returned: Postgres messages name relations and policies.
    console.error("push unsubscribe failed:", error.message);
    return NextResponse.json(
      { error: "Could not remove this device." },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
