import type { Metadata } from "next";

// NOTE: This policy is a working draft prepared for attorney review before
// wide distribution. Keep the effective date current when material changes ship.

export const metadata: Metadata = { title: "Privacy Policy" };

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

export default function PrivacyPage() {
  return (
    <article className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-1">Privacy Policy</h1>
        <p className="text-sm text-muted">Effective {EFFECTIVE_DATE}</p>
      </div>

      <Section title="Who We Are">
        <p>
          CogNote Studio (&ldquo;CogNote&rdquo;, &ldquo;we&rdquo;,
          &ldquo;us&rdquo;) is operated by Morales Piano Studio LLC, doing
          business as CogNote Studio. This policy covers the hosted service at
          cognote.studio. If your teacher runs their own self-hosted copy of
          the CogNote software, that deployment is operated by them, not by
          us, and this policy does not apply to it.
        </p>
      </Section>

      <Section title="Information We Collect">
        <p>
          <strong>Teacher accounts.</strong> When a teacher signs up we collect
          an email address, a display name, an optional profile photo, and a
          timezone. If a teacher subscribes to a paid plan, our payment
          processor (Stripe) collects billing details; we store only
          subscription status and Stripe identifiers, never card numbers.
        </p>
        <p>
          <strong>Student and family records entered by teachers.</strong>{" "}
          Teachers add records about their students and families to run their
          studios: names, optional birthdates, parent contact information,
          lesson schedules, attendance, lesson notes, invoices, and assigned
          sheet music. The teacher is the data controller for these records;
          we process them on the teacher&apos;s behalf to provide the service.
        </p>
        <p>
          <strong>Practice activity.</strong> When a student uses a practice
          link, we record quiz answers, scores, and flashcard progress tied to
          that student&apos;s record so their teacher can track progress.
          Practice links and family portals do not require accounts,
          passwords, or email addresses from students or parents.
        </p>
        <p>
          <strong>Technical data.</strong> We keep standard server logs (IP
          address, request time, user agent) for security and abuse
          prevention. We use cookies only to keep teachers signed in; we do
          not use advertising or cross-site tracking cookies.
        </p>
      </Section>

      <Section title="Children's Privacy">
        <p>
          CogNote is a tool for teachers and parents. Students, including
          children under 13, never create accounts, and we do not knowingly
          collect personal information directly from children. Student records
          are created and controlled by the teacher, who is responsible for
          having the family&apos;s permission to store them. Practice links
          collect only the practice activity described above. Parents who want
          a student&apos;s records corrected or deleted should contact their
          teacher, who can edit or delete them at any time; you can also
          contact us directly.
        </p>
      </Section>

      <Section title="How We Use Information">
        <p>
          We use the information above solely to provide and secure the
          service: showing teachers their studio data, delivering emails the
          teacher initiates (practice links, lesson notes, invoices,
          reminders), processing subscription payments, and preventing abuse.
        </p>
        <p>
          We do not sell personal information, we do not use it for
          advertising, and we do not use student records to train AI models.
          If a teacher connects their own optional AI key, requests they
          initiate are sent to their chosen provider under that
          provider&apos;s terms.
        </p>
      </Section>

      <Section title="Service Providers">
        <p>We rely on a small set of subprocessors to run the service:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>
            <strong>Supabase</strong> — database, authentication, and file
            storage.
          </li>
          <li>
            <strong>Vercel</strong> — application hosting.
          </li>
          <li>
            <strong>Stripe</strong> — payment processing for CogNote
            subscriptions, and for lesson tuition when a teacher connects
            their own Stripe account.
          </li>
          <li>
            <strong>Resend</strong> — transactional email delivery.
          </li>
        </ul>
        <p>
          Each provider receives only the data needed to perform its function.
        </p>
      </Section>

      <Section title="Security">
        <p>
          All traffic is encrypted in transit (TLS). Studio data is isolated
          per teacher account with database-level row security. Sensitive
          credentials that teachers store with us (such as their own Stripe or
          AI keys) are encrypted at rest and are never included in data
          exports.
        </p>
      </Section>

      <Section title="Retention, Export, and Deletion">
        <p>
          We keep studio data for as long as the teacher&apos;s account is
          active, on any plan. Teachers can export their full studio data as a
          JSON file at any time from Account settings. When a teacher deletes
          their account, or asks us to, we delete the account and its studio
          data, minus records we must keep for legal or accounting reasons
          (such as subscription payment history), within 30 days.
        </p>
      </Section>

      <Section title="Changes and Contact">
        <p>
          If we make material changes to this policy we will update the
          effective date above and notify teachers by email or in the app.
          Questions and requests:{" "}
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
