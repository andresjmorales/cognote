import Link from "next/link";
import {
  formatHostedPrice,
  getDeploymentMode,
  getHostedLimits,
  getHostedMonthlyPriceCents,
  getHostedTrialDays,
} from "@/lib/entitlements";
import { BrandMark } from "@/components/brand/BrandMark";
import { Button } from "@/components/ui/button";
import { BRAND_ICON_SIZE } from "@/lib/ui-constants";
import { isHostedCheckoutConfigured } from "@/lib/hosted-billing/stripe";

export const metadata = { title: "Hosting options — CogNote" };

export default function HostingOptionsPage() {
  const deployment = getDeploymentMode();
  const limits = getHostedLimits();
  const price = formatHostedPrice(getHostedMonthlyPriceCents());
  const trialDays = getHostedTrialDays();
  const checkoutReady = isHostedCheckoutConfigured();

  if (deployment === "self_hosted") {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-surface">
          <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2 text-xl font-bold text-primary tracking-tight"
            >
              <BrandMark size={BRAND_ICON_SIZE.header} className="h-8 w-8" />
              CogNote
            </Link>
            <Link href="/login">
              <Button size="sm" variant="secondary">
                Teacher Login
              </Button>
            </Link>
          </div>
        </header>
        <main className="max-w-xl mx-auto px-4 py-16 text-center">
          <h1 className="text-3xl font-bold mb-3 font-[family-name:var(--font-nunito)]">
            No subscription on this install
          </h1>
          <p className="text-muted text-sm mb-6 leading-relaxed">
            You&apos;re running CogNote yourself, so there&apos;s nothing to
            pay here — full product, no limits. Hosted CogNote (we run the
            servers for you) is a separate option if you&apos;d rather not
            manage infrastructure.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/">
              <Button>Back to home</Button>
            </Link>
            <a
              href="https://github.com/andresjmorales/cognote"
              target="_blank"
              rel="noreferrer"
            >
              <Button variant="secondary">GitHub</Button>
            </a>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-xl font-bold text-primary tracking-tight"
          >
            <BrandMark size={BRAND_ICON_SIZE.header} className="h-8 w-8" />
            CogNote
          </Link>
          <Link href="/login">
            <Button size="sm" variant="secondary">
              Teacher Login
            </Button>
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-14">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold mb-3 font-[family-name:var(--font-nunito)]">
            Free to self-host. Or let us host it.
          </h1>
          <p className="text-muted max-w-2xl mx-auto text-sm leading-relaxed">
            CogNote is open source (MIT). Run it yourself for free with the
            full product, or use our hosted instance — we handle updates,
            backups, and email. Hosted includes a free tier with caps; Pro
            removes them.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-10">
          <section className="border border-border rounded-2xl p-6 bg-surface">
            <h2 className="text-xl font-bold mb-1">Self-hosted</h2>
            <p className="text-3xl font-bold text-primary mb-3">$0</p>
            <p className="text-sm text-muted mb-4">
              You run the stack (Docker / Supabase, email, backups). No CogNote
              fee. Export anytime.
            </p>
            <ul className="text-sm space-y-2 mb-6 text-muted">
              <li>Unlimited students, lessons, and sheet music</li>
              <li>Optional: your own Stripe for family tuition</li>
              <li>Same app as hosted</li>
            </ul>
            <a
              href="https://github.com/andresjmorales/cognote#getting-started"
              target="_blank"
              rel="noreferrer"
            >
              <Button variant="secondary" className="w-full">
                Setup guide
              </Button>
            </a>
          </section>

          <section className="border border-primary/40 rounded-2xl p-6 bg-surface">
            <h2 className="text-xl font-bold mb-1">Hosted</h2>
            <p className="text-3xl font-bold text-primary mb-1">
              {price}
              <span className="text-base font-semibold text-muted">/mo</span>
            </p>
            <p className="text-xs text-muted mb-3">
              Pro · {trialDays}-day full trial, then free with caps
            </p>
            <p className="text-sm text-muted mb-4">
              We run it for you. Tuition you collect stays yours — CogNote
              doesn&apos;t take a cut.
            </p>
            <ul className="text-sm space-y-2 mb-6 text-muted">
              <li>
                Free after trial: {limits.maxStudents} active students,{" "}
                {limits.maxPlans} practice lessons, {limits.maxSheetItems}{" "}
                sheet music items
              </li>
              <li>Pro: no create caps; export or self-host anytime</li>
              <li>Archived students don&apos;t count toward the free limit</li>
              <li>Sending invoices stays free (no paywall on tuition)</li>
            </ul>
            <div className="flex flex-col gap-2">
              <Link href="/login">
                <Button className="w-full">
                  {checkoutReady ? "Start free trial" : "Create account"}
                </Button>
              </Link>
              <p className="text-xs text-muted text-center">
                Already signed in? Upgrade under{" "}
                <Link href="/account" className="text-primary font-semibold">
                  Account
                </Link>
                .
              </p>
            </div>
          </section>
        </div>

        <p className="text-center text-sm text-muted">
          Questions?{" "}
          <a
            href="mailto:support@cognote.studio"
            className="text-primary font-semibold"
          >
            support@cognote.studio
          </a>
        </p>
      </main>
    </div>
  );
}
