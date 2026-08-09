import { Card } from "@/components/ui/card";
import type { StudioPolicy } from "@/lib/schedule";

function makeupSummary(policy: StudioPolicy): string[] {
  const earns: string[] = [];
  const doesNot: string[] = [];
  const bucket = (label: string, earnsCredit: boolean) =>
    (earnsCredit ? earns : doesNot).push(label);

  bucket("cancelling with enough notice", policy.timely_cancel_earns_makeup);
  bucket("cancelling late", policy.late_cancel_earns_makeup);
  bucket("missing a lesson without notice", policy.no_show_earns_makeup);
  bucket("lessons the teacher cancels", policy.teacher_cancel_earns_makeup);

  const lines: string[] = [];
  if (earns.length > 0) {
    lines.push(`A make-up credit is earned for: ${earns.join(", ")}.`);
  }
  if (doesNot.length > 0) {
    lines.push(`No make-up credit for: ${doesNot.join(", ")}.`);
  }
  if (earns.length > 0) {
    lines.push(
      policy.makeup_credit_expiry_days != null
        ? `Make-up credits expire ${policy.makeup_credit_expiry_days} days after they are earned.`
        : "Make-up credits do not expire."
    );
  }
  return lines;
}

function billingSummary(policy: StudioPolicy): string[] {
  const billed: string[] = [];
  const notBilled: string[] = [];
  const bucket = (label: string, isBilled: boolean) =>
    (isBilled ? billed : notBilled).push(label);

  bucket("attended lessons", policy.bill_attended);
  bucket("missed lessons without notice", policy.bill_no_show);
  bucket("late cancellations", policy.bill_late_student_cancel);
  bucket("timely cancellations", policy.bill_timely_student_cancel);
  bucket("lessons the teacher cancels", policy.bill_teacher_cancel);
  bucket("make-up lessons", policy.bill_makeup);

  const lines: string[] = [];
  if (billed.length > 0) {
    lines.push(`Billed: ${billed.join(", ")}.`);
  }
  if (notBilled.length > 0) {
    lines.push(`Not billed: ${notBilled.join(", ")}.`);
  }
  lines.push(
    policy.invoice_cadence === "monthly"
      ? "Invoices are sent monthly."
      : "Invoices are sent by the teacher as needed."
  );
  lines.push("For lesson rates, please ask your teacher.");
  return lines;
}

/**
 * Read-only, family-friendly summary of the studio's policies. Rates are
 * intentionally omitted; per-student rates stay between teacher and family.
 */
export function StudioPoliciesSection({ policy }: { policy: StudioPolicy }) {
  const makeupLines = makeupSummary(policy);
  const billingLines = billingSummary(policy);

  return (
    <section id="studio-policies">
      <h2 className="text-lg font-semibold mb-3">Studio Policies</h2>
      <Card padding="sm">
        <div className="space-y-4 text-sm">
          <div>
            <h3 className="font-semibold mb-1">Cancellations</h3>
            <p className="text-muted">
              Please cancel at least {policy.cancellation_window_hours} hours
              before a lesson. Cancellations inside that window count as late.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-1">Make-up Lessons</h3>
            <ul className="text-muted space-y-0.5 list-disc list-inside">
              {makeupLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-1">Billing</h3>
            <ul className="text-muted space-y-0.5 list-disc list-inside">
              {billingLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          {policy.policies_updated_at && (
            <p className="text-xs text-muted">
              Last updated{" "}
              {new Date(policy.policies_updated_at).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
                timeZone: policy.timezone,
              })}
              .
            </p>
          )}
        </div>
      </Card>
    </section>
  );
}
