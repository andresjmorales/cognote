import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPolicy } from "@/lib/server/scheduling";
import { maskSecret, validateLiveStripeKeys } from "@/lib/billing";
import type { InvoiceCadence, PaymentProvider, RateBasis } from "@/lib/schedule";
import type { AiProviderId } from "@/lib/ai/provider";

/** Client-safe policy: secrets are masked, never returned in full. */
function toClientPolicy(
  policy: Awaited<ReturnType<typeof getPolicy>>,
  teacherId: string
) {
  const {
    stripe_secret_key,
    stripe_publishable_key,
    stripe_webhook_secret,
    ai_api_key,
    ...rest
  } = policy;
  return {
    ...rest,
    teacherId,
    stripe_secret_key: null,
    stripe_publishable_key: null,
    stripe_webhook_secret: null,
    ai_api_key: null,
    stripe: {
      secretKey: {
        configured: !!stripe_secret_key,
        masked: maskSecret(stripe_secret_key),
      },
      publishableKey: {
        configured: !!stripe_publishable_key,
        masked: maskSecret(stripe_publishable_key),
      },
      webhookSecret: {
        configured: !!stripe_webhook_secret,
        masked: maskSecret(stripe_webhook_secret),
      },
    },
    ai: {
      apiKey: {
        configured: !!ai_api_key,
        masked: maskSecret(ai_api_key),
      },
    },
  };
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const policy = await getPolicy(supabase, user.id);
  return NextResponse.json(toClientPolicy(policy, user.id));
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  if (body.timezone) {
    const { isValidTimezone } = await import("@/lib/timezones");
    if (!isValidTimezone(body.timezone)) {
      return NextResponse.json({ error: "Invalid timezone" }, { status: 400 });
    }
  }

  let durationOptions: number[] | undefined;
  if (body.lessonDurationOptions !== undefined) {
    if (!Array.isArray(body.lessonDurationOptions)) {
      return NextResponse.json(
        { error: "lessonDurationOptions must be an array" },
        { status: 400 }
      );
    }
    const cleaned = (body.lessonDurationOptions as unknown[])
      .map((v) => Number(v))
      .filter((v) => Number.isInteger(v) && v >= 5 && v <= 240);
    durationOptions = [...new Set(cleaned)].sort((a, b) => a - b);
    if (durationOptions.length === 0) {
      return NextResponse.json(
        { error: "At least one time block between 5 and 240 minutes is required" },
        { status: 400 }
      );
    }
  }

  const cadence = body.invoiceCadence as InvoiceCadence | undefined;
  if (cadence !== undefined && cadence !== "monthly" && cadence !== "manual") {
    return NextResponse.json(
      { error: "invoiceCadence must be monthly or manual" },
      { status: 400 }
    );
  }

  const rateBasis = body.rateBasis as RateBasis | undefined;
  if (
    rateBasis !== undefined &&
    rateBasis !== "per_lesson" &&
    rateBasis !== "per_hour"
  ) {
    return NextResponse.json(
      { error: "rateBasis must be per_lesson or per_hour" },
      { status: 400 }
    );
  }

  const paymentProvider = body.paymentProvider as PaymentProvider | undefined;
  if (
    paymentProvider !== undefined &&
    paymentProvider !== "manual" &&
    paymentProvider !== "stripe"
  ) {
    return NextResponse.json(
      { error: "paymentProvider must be manual or stripe" },
      { status: 400 }
    );
  }

  const aiProvider = body.aiProvider as AiProviderId | undefined;
  if (
    aiProvider !== undefined &&
    aiProvider !== "none" &&
    aiProvider !== "openai" &&
    aiProvider !== "anthropic"
  ) {
    return NextResponse.json(
      { error: "aiProvider must be none, openai, or anthropic" },
      { status: 400 }
    );
  }

  const upsert: Record<string, unknown> = {
    teacher_id: user.id,
    ...(body.studioName !== undefined && {
      studio_name: String(body.studioName).trim().slice(0, 120),
    }),
    ...(body.studioWebsite !== undefined && {
      studio_website: String(body.studioWebsite).trim().slice(0, 300),
    }),
    ...(body.studioContact !== undefined && {
      studio_contact: String(body.studioContact).trim().slice(0, 300),
    }),
    ...(body.studioInfo !== undefined && {
      studio_info: String(body.studioInfo).trim().slice(0, 5000),
    }),
    ...(durationOptions !== undefined && {
      lesson_duration_options: durationOptions,
    }),
    ...(body.timezone !== undefined && { timezone: body.timezone }),
    ...(body.cancellationWindowHours !== undefined && {
      cancellation_window_hours: Number(body.cancellationWindowHours),
    }),
    ...(body.timelyCancelEarnsMakeup !== undefined && {
      timely_cancel_earns_makeup: Boolean(body.timelyCancelEarnsMakeup),
    }),
    ...(body.lateCancelEarnsMakeup !== undefined && {
      late_cancel_earns_makeup: Boolean(body.lateCancelEarnsMakeup),
    }),
    ...(body.noShowEarnsMakeup !== undefined && {
      no_show_earns_makeup: Boolean(body.noShowEarnsMakeup),
    }),
    ...(body.teacherCancelEarnsMakeup !== undefined && {
      teacher_cancel_earns_makeup: Boolean(body.teacherCancelEarnsMakeup),
    }),
    ...(body.makeupCreditExpiryDays !== undefined && {
      makeup_credit_expiry_days: body.makeupCreditExpiryDays
        ? Number(body.makeupCreditExpiryDays)
        : null,
    }),
    // Billing
    ...(body.billAttended !== undefined && {
      bill_attended: Boolean(body.billAttended),
    }),
    ...(body.billNoShow !== undefined && {
      bill_no_show: Boolean(body.billNoShow),
    }),
    ...(body.billTeacherCancel !== undefined && {
      bill_teacher_cancel: Boolean(body.billTeacherCancel),
    }),
    ...(body.billTimelyStudentCancel !== undefined && {
      bill_timely_student_cancel: Boolean(body.billTimelyStudentCancel),
    }),
    ...(body.billLateStudentCancel !== undefined && {
      bill_late_student_cancel: Boolean(body.billLateStudentCancel),
    }),
    ...(body.billMakeup !== undefined && {
      bill_makeup: Boolean(body.billMakeup),
    }),
    ...(body.defaultRateCents !== undefined && {
      default_rate_cents:
        body.defaultRateCents === null || body.defaultRateCents === ""
          ? null
          : Math.max(0, Math.round(Number(body.defaultRateCents))),
    }),
    ...(rateBasis !== undefined && { rate_basis: rateBasis }),
    ...(body.currency !== undefined && {
      currency: String(body.currency).trim().toUpperCase().slice(0, 3) || "USD",
    }),
    ...(cadence !== undefined && { invoice_cadence: cadence }),
    ...(body.paymentInstructions !== undefined && {
      payment_instructions: String(body.paymentInstructions).slice(0, 2000),
    }),
    ...(paymentProvider !== undefined && {
      payment_provider: paymentProvider,
    }),
    ...(body.notifyInApp !== undefined && {
      notify_in_app: Boolean(body.notifyInApp),
    }),
    ...(body.notifyEmailPortalCancel !== undefined && {
      notify_email_portal_cancel: Boolean(body.notifyEmailPortalCancel),
    }),
    ...(body.notifyEmailInvoicePaid !== undefined && {
      notify_email_invoice_paid: Boolean(body.notifyEmailInvoicePaid),
    }),
    ...(aiProvider !== undefined && { ai_provider: aiProvider }),
    ...(body.streaksEnabled !== undefined && {
      streaks_enabled: Boolean(body.streaksEnabled),
    }),
    ...(body.streakCountQuiz !== undefined && {
      streak_count_quiz: Boolean(body.streakCountQuiz),
    }),
    ...(body.streakCountFreePractice !== undefined && {
      streak_count_free_practice: Boolean(body.streakCountFreePractice),
    }),
    ...(body.streakCountFlashcards !== undefined && {
      streak_count_flashcards: Boolean(body.streakCountFlashcards),
    }),
  };

  // Stripe keys: only overwrite when a new value is pasted, or explicitly
  // cleared. Secrets are encrypted at rest (decrypted in getPolicy).
  // Reject test/sandbox keys so teachers don't collect live payments on a
  // test account. Check the effective keys after this save (new paste or
  // already-stored) whenever Stripe is (or will be) the provider.
  const { encryptSecret } = await import("@/lib/token");
  const currentPolicy = await getPolicy(supabase, user.id);

  const nextSecretRaw = body.clearStripeSecretKey
    ? null
    : typeof body.stripeSecretKey === "string" && body.stripeSecretKey.trim()
      ? body.stripeSecretKey.trim()
      : undefined;
  const nextPublishableRaw = body.clearStripePublishableKey
    ? null
    : typeof body.stripePublishableKey === "string" &&
        body.stripePublishableKey.trim()
      ? body.stripePublishableKey.trim()
      : undefined;

  const effectiveProvider = paymentProvider ?? currentPolicy.payment_provider;
  if (effectiveProvider === "stripe") {
    const keyError = validateLiveStripeKeys({
      secretKey:
        nextSecretRaw === undefined
          ? currentPolicy.stripe_secret_key
          : nextSecretRaw,
      publishableKey:
        nextPublishableRaw === undefined
          ? currentPolicy.stripe_publishable_key
          : nextPublishableRaw,
    });
    if (keyError) {
      return NextResponse.json({ error: keyError }, { status: 400 });
    }
  }

  if (body.clearStripeSecretKey) upsert.stripe_secret_key = null;
  else if (nextSecretRaw) {
    upsert.stripe_secret_key = encryptSecret(nextSecretRaw);
  }
  if (body.clearStripePublishableKey) upsert.stripe_publishable_key = null;
  else if (nextPublishableRaw) {
    upsert.stripe_publishable_key = nextPublishableRaw;
  }
  if (body.clearStripeWebhookSecret) upsert.stripe_webhook_secret = null;
  else if (
    typeof body.stripeWebhookSecret === "string" &&
    body.stripeWebhookSecret.trim()
  ) {
    upsert.stripe_webhook_secret = encryptSecret(body.stripeWebhookSecret.trim());
  }

  if (body.clearAiApiKey) upsert.ai_api_key = null;
  else if (typeof body.aiApiKey === "string" && body.aiApiKey.trim()) {
    upsert.ai_api_key = encryptSecret(body.aiApiKey.trim());
  }
  if (aiProvider === "none") {
    upsert.ai_api_key = null;
  }

  // Bump policies_updated_at when a family-relevant field actually changes,
  // so the portal can show its one-time "policies were updated" banner.
  const FAMILY_RELEVANT_FIELDS = [
    "cancellation_window_hours",
    "timely_cancel_earns_makeup",
    "late_cancel_earns_makeup",
    "no_show_earns_makeup",
    "teacher_cancel_earns_makeup",
    "makeup_credit_expiry_days",
    "bill_attended",
    "bill_no_show",
    "bill_teacher_cancel",
    "bill_timely_student_cancel",
    "bill_late_student_cancel",
    "bill_makeup",
    "invoice_cadence",
  ] as const;
  const familyRelevantChanged = FAMILY_RELEVANT_FIELDS.some(
    (field) =>
      field in upsert &&
      upsert[field] !== (currentPolicy as unknown as Record<string, unknown>)[field]
  );
  if (familyRelevantChanged) {
    upsert.policies_updated_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("studio_policies")
    .upsert(upsert, { onConflict: "teacher_id" })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Re-fetch through getPolicy so defaults merge, then mask for the client
  const policy = await getPolicy(supabase, user.id);
  return NextResponse.json(toClientPolicy(policy, user.id));
}
