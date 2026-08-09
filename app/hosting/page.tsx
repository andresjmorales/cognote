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

function PageChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
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
      {children}
    </div>
  );
}

export default function HostingOptionsPage() {
  const deployment = getDeploymentMode();
  const limits = getHostedLimits();
  const price = formatHostedPrice(getHostedMonthlyPriceCents());
  const trialDays = getHostedTrialDays();
  const checkoutReady = isHostedCheckoutConfigured();

  if (deployment === "self_hosted") {
    return (
      <PageChrome>
        <main className="max-w-xl mx-auto px-4 py-16 text-center">
          <h1 className="text-3xl font-bold mb-3 font-[family-name:var(--font-nunito)]">
            No subscription on this install
          </h1>
          <p className="text-muted text-sm mb-6 leading-relaxed">
            You&apos;re running CogNote yourself, so there&apos;s nothing to
            pay here: full product, no limits. Hosted CogNote (we run the
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
      </PageChrome>
    );
  }

  return (
    <PageChrome>
      <main className="max-w-5xl mx-auto px-4 py-14">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold mb-3 font-[family-name:var(--font-nunito)]">
            Free to self-host. Or let us host it.
          </h1>
          <p className="text-muted max-w-2xl mx-auto text-sm leading-relaxed">
            CogNote is open source (MIT). Run it yourself, or use our hosted
            instance. Hosted starts with a {trialDays}-day full trial, then
            stays free with soft caps. Go Pro to remove the caps.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5 mb-10">
          <section className="border border-border rounded-2xl p-6 bg-surface flex flex-col">
            <h2 className="text-xl font-bold mb-1">Self-hosted</h2>
            <p className="text-3xl font-bold text-primary mb-3">$0</p>
            <p className="text-sm text-muted mb-4 flex-1">
              You run the stack (Docker / Supabase, email, backups). No CogNote
              fee. Same app as hosted.
            </p>
            <ul className="text-sm space-y-2 mb-6 text-muted">
              <li>Unlimited students, lessons, sheet music</li>
              <li>Optional: your own Stripe for tuition</li>
              <li>Export anytime</li>
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

          <section className="border border-border rounded-2xl p-6 bg-surface flex flex-col">
            <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1">
              Hosted
            </p>
            <h2 className="text-xl font-bold mb-1">Free</h2>
            <p className="text-3xl font-bold text-primary mb-3">$0</p>
            <p className="text-sm text-muted mb-4 flex-1">
              We run updates, backups, and email. After the {trialDays}-day
              trial you keep using CogNote with soft caps.
            </p>
            <ul className="text-sm space-y-2 mb-6 text-muted">
              <li>Up to {limits.maxStudents} active students</li>
              <li>
                {limits.maxPlans} practice lessons, {limits.maxSheetItems} sheet
                music items
              </li>
              <li>Sending invoices stays free</li>
            </ul>
            <Link href="/login">
              <Button variant="secondary" className="w-full">
                Create account
              </Button>
            </Link>
          </section>

          <section className="border border-primary/40 rounded-2xl p-6 bg-surface flex flex-col">
            <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1">
              Hosted
            </p>
            <h2 className="text-xl font-bold mb-1">Pro</h2>
            <p className="text-3xl font-bold text-primary mb-1">
              {price}
              <span className="text-base font-semibold text-muted">/mo</span>
            </p>
            <p className="text-xs text-muted mb-3">
              {trialDays}-day full trial included for new accounts
            </p>
            <p className="text-sm text-muted mb-4 flex-1">
              Same hosting as Free plan, without any caps on creation.
            </p>
            <ul className="text-sm space-y-2 mb-6 text-muted">
              <li>Unlimited students, lessons, sheet music</li>
              <li>Export or switch to self-host anytime</li>
              <li>Same family portal and practice tools</li>
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
        <p className="text-center text-sm text-muted mt-3">
          <Link href="/privacy" className="hover:text-foreground transition-colors">
            Privacy Policy
          </Link>
          <span className="mx-2">·</span>
          <Link href="/terms" className="hover:text-foreground transition-colors">
            Terms of Service
          </Link>
        </p>
      </main>
    </PageChrome>
  );
}
