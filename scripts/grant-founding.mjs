/**
 * Grant a founding membership and stop any Stripe billing in one step.
 *
 * Founding is free for life. Setting hosted_plan = 'founding' in SQL alone
 * leaves an existing Pro subscription running in Stripe, which keeps
 * charging the member. This script does both.
 *
 * Usage:
 *   node --env-file=.env.local scripts/grant-founding.mjs <email|teacher-id> [--number N] [--apply]
 *
 * Without --apply it only prints what it would change (dry run).
 * Needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and
 * HOSTED_STRIPE_SECRET_KEY (or STRIPE_SECRET_KEY).
 *
 * It does not refund past charges; issue those from the Stripe dashboard.
 */

import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const BILLABLE = new Set([
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "incomplete",
  "paused",
]);

function usage(msg) {
  if (msg) console.error(`Error: ${msg}\n`);
  console.error(
    "Usage: node --env-file=.env.local scripts/grant-founding.mjs <email|teacher-id> [--number N] [--apply]"
  );
  process.exit(1);
}

function parseArgs(argv) {
  const out = { target: null, number: null, apply: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--apply") out.apply = true;
    else if (a === "--number") {
      const n = Number(argv[++i]);
      if (!Number.isInteger(n) || n < 1) usage("--number must be a positive integer");
      out.number = n;
    } else if (a.startsWith("--")) usage(`unknown flag ${a}`);
    else if (out.target) usage("only one teacher can be granted at a time");
    else out.target = a;
  }
  if (!out.target) usage("missing email or teacher id");
  return out;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    usage("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  const stripeKey =
    process.env.HOSTED_STRIPE_SECRET_KEY?.trim() ||
    process.env.STRIPE_SECRET_KEY?.trim();

  const db = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const column = UUID_RE.test(args.target) ? "id" : "email";
  const query = db
    .from("teachers")
    .select(
      "id, email, display_name, hosted_plan, founding_number, stripe_customer_id, stripe_subscription_id"
    );
  const { data: matches, error } =
    column === "id"
      ? await query.eq("id", args.target)
      : await query.eq("email", args.target.trim().toLowerCase());
  if (error) throw error;
  if (!matches?.length) usage(`no teacher found with ${column} ${args.target}`);
  if (matches.length > 1) usage(`${matches.length} teachers match ${args.target}; use the id`);
  const teacher = matches[0];

  let foundingNumber = teacher.founding_number ?? args.number;
  if (foundingNumber == null) {
    const { data: top, error: topErr } = await db
      .from("teachers")
      .select("founding_number")
      .not("founding_number", "is", null)
      .order("founding_number", { ascending: false })
      .limit(1);
    if (topErr) throw topErr;
    foundingNumber = (top?.[0]?.founding_number ?? 0) + 1;
  }

  let subs = [];
  let stripe = null;
  if (teacher.stripe_customer_id) {
    if (!stripeKey) {
      usage(
        "teacher has a Stripe customer but no Stripe secret key is set; cannot check billing"
      );
    }
    stripe = new Stripe(stripeKey);
    for await (const sub of stripe.subscriptions.list({
      customer: teacher.stripe_customer_id,
      status: "all",
      limit: 100,
    })) {
      if (BILLABLE.has(sub.status)) subs.push(sub);
    }
  }

  console.log(`Teacher:        ${teacher.display_name ?? "(no name)"} <${teacher.email}> (${teacher.id})`);
  console.log(`Current plan:   ${teacher.hosted_plan}`);
  console.log(`Founding #:     ${teacher.founding_number ?? "none"} -> ${foundingNumber}`);
  console.log(`Stripe customer: ${teacher.stripe_customer_id ?? "none"}`);
  if (subs.length) {
    console.log("Subscriptions to cancel now:");
    for (const s of subs) console.log(`  ${s.id} (${s.status})`);
  } else {
    console.log("Subscriptions to cancel now: none");
  }

  if (!args.apply) {
    console.log("\nDry run. Re-run with --apply to make these changes.");
    return;
  }

  // Grant founding first: the webhook leaves founding rows alone when the
  // cancellation events arrive, so the member is never demoted to free.
  const { error: updErr } = await db
    .from("teachers")
    .update({
      hosted_plan: "founding",
      founding_number: foundingNumber,
      stripe_subscription_id: null,
      stripe_cancel_at: null,
    })
    .eq("id", teacher.id);
  if (updErr) throw updErr;
  console.log("\nGranted founding membership.");

  for (const s of subs) {
    try {
      await stripe.subscriptions.cancel(s.id);
      console.log(`Cancelled ${s.id}.`);
    } catch (err) {
      if (err?.code === "resource_missing" || /already (been )?cancel/i.test(err?.message ?? "")) {
        console.log(`${s.id} was already cancelled.`);
      } else {
        throw err;
      }
    }
  }
  console.log("Done. Refund any charges made after founding was granted from the Stripe dashboard.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
