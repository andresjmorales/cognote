import type { Metadata } from "next";

// NOTE: These terms are a working draft prepared for attorney review before
// wide distribution. Keep the effective date current when material changes ship.

export const metadata: Metadata = { title: "Terms of Service" };

const EFFECTIVE_DATE = "August 8, 2026";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="text-sm leading-relaxed text-muted space-y-2">
        {children}
      </div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <article className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-1">Terms of Service</h1>
        <p className="text-sm text-muted">Effective {EFFECTIVE_DATE}</p>
      </div>

      <Section title="The Agreement">
        <p>
          These terms are an agreement between you and Morales Piano Studio
          LLC, doing business as CogNote Studio (&ldquo;CogNote&rdquo;,
          &ldquo;we&rdquo;, &ldquo;us&rdquo;), covering the hosted service at
          cognote.studio. By creating an account or using the service, you
          accept them. The CogNote software is also available under the MIT
          license for self-hosting; these terms do not apply to self-hosted
          deployments.
        </p>
      </Section>

      <Section title="Your Account">
        <p>
          You must provide accurate account information and keep your sign-in
          credentials, family portal links, and practice links reasonably
          protected. You are responsible for activity under your account. The
          service is intended for use by adults (teachers and parents);
          students use practice links under their teacher&apos;s and
          family&apos;s supervision without accounts of their own.
        </p>
      </Section>

      <Section title="Your Studio Data">
        <p>
          You own the data you enter into CogNote. By entering records about
          students and families, you confirm you have the authority or
          permission to store them, and you agree to use them only for running
          your studio. We process this data to provide the service as
          described in our{" "}
          <a href="/privacy" className="text-primary hover:underline">
            Privacy Policy
          </a>
          . You can export your full studio data at any time.
        </p>
      </Section>

      <Section title="Plans, Billing, and Cancellation">
        <p>
          The Free plan applies soft limits on active students, lesson
          templates, and sheet music items. Paid plans are billed in advance
          through Stripe on a recurring basis until cancelled.
        </p>
        <p>
          You can cancel a paid plan at any time from Account settings. After
          cancelling, you keep paid features until the end of the period you
          already paid for; we do not issue prorated refunds for partial
          periods. Your account then moves to the Free plan. Nothing is
          deleted or hidden when a plan ends: all of your data remains, family
          portals and practice links keep working, and export remains
          available. If your studio is over the Free plan limits, you cannot
          create new students, lessons, or sheet music uploads until you
          archive enough records or upgrade again.
        </p>
        <p>
          If you connect your own Stripe account to collect lesson tuition,
          that billing relationship is between you, your families, and Stripe;
          we are not a party to those payments.
        </p>
      </Section>

      <Section title="Acceptable Use">
        <p>
          Do not use the service to violate the law, infringe others&apos;
          rights, distribute malware, send spam, or attempt to access other
          teachers&apos; data. Only upload sheet music you have the right to
          use and share. We may suspend accounts that put the service or other
          users at risk, and will tell you why unless the law prevents it.
        </p>
      </Section>

      <Section title="Service Changes and Availability">
        <p>
          We work to keep the service reliable but provide it &ldquo;as
          is&rdquo; without warranties of any kind. We may change or
          discontinue features. If we ever discontinue the hosted service
          entirely, we will give at least 60 days&apos; notice so you can
          export your data or move to a self-hosted deployment.
        </p>
      </Section>

      <Section title="Limitation of Liability">
        <p>
          To the fullest extent permitted by law, Morales Piano Studio LLC is
          not liable for indirect, incidental, or consequential damages
          arising from your use of the service, and our total liability for
          any claim is limited to the amount you paid us in the twelve months
          before the claim arose.
        </p>
      </Section>

      <Section title="Termination">
        <p>
          You can delete your account at any time. We may terminate accounts
          that materially violate these terms. On termination, the data
          handling described in the Privacy Policy applies, and you may
          request an export before deletion.
        </p>
      </Section>

      <Section title="Governing Law and Changes">
        <p>
          These terms are governed by the laws of the State of Texas. If we
          make material changes, we will update the effective date above and
          notify account holders by email or in the app before the changes
          take effect. Questions:{" "}
          <a
            href="mailto:support@cognote.studio"
            className="text-primary hover:underline"
          >
            support@cognote.studio
          </a>
          .
        </p>
      </Section>
    </article>
  );
}
