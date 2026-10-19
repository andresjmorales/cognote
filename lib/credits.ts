/**
 * Prepaid lesson credits (issue #119).
 *
 * A family buys a package of fixed-count credits for one student and one
 * lesson length ("10 × 30-min lessons"). Each billable lesson of that length
 * uses one credit instead of going on an invoice. When no credit covers a
 * lesson it bills normally.
 *
 * Which lesson uses which credit is a pure function of (billable lessons,
 * packages), like the rest of billing. The result is written to the
 * credit_redemptions ledger when invoices are generated, and the database
 * refuses a lesson that is both redeemed and invoiced.
 */

export interface CreditPackageInput {
  id: string;
  studentId: string;
  durationMinutes: number;
  credits: number;
  /** Credits already written to the redemption ledger. */
  usedCredits: number;
  /** YYYY-MM-DD; the first lesson date the package can cover. */
  startsOn: string;
  /** YYYY-MM-DD, inclusive; null = never expires. */
  expiresOn: string | null;
  /** The purchase invoice has been sent or paid (not draft or void). */
  active: boolean;
}

export interface CreditCandidate {
  lessonId: string;
  studentId: string;
  /** YYYY-MM-DD, studio-local. */
  lessonDate: string;
  startsAt: string;
  durationMinutes: number;
}

/** Whether a package can cover this lesson, ignoring how many credits remain. */
export function packageCoversLesson(
  pkg: CreditPackageInput,
  lesson: CreditCandidate
): boolean {
  return (
    pkg.active &&
    pkg.studentId === lesson.studentId &&
    pkg.durationMinutes === lesson.durationMinutes &&
    lesson.lessonDate >= pkg.startsOn &&
    (pkg.expiresOn == null || lesson.lessonDate <= pkg.expiresOn)
  );
}

/** Soonest expiry first (never-expiring last), then oldest package. */
function comparePackages(a: CreditPackageInput, b: CreditPackageInput): number {
  if (a.expiresOn !== b.expiresOn) {
    if (a.expiresOn == null) return 1;
    if (b.expiresOn == null) return -1;
    return a.expiresOn < b.expiresOn ? -1 : 1;
  }
  if (a.startsOn !== b.startsOn) return a.startsOn < b.startsOn ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Assign credits to billable lessons, oldest lesson first, each lesson taking
 * a credit from the eligible package that expires soonest. Expiry is checked
 * against the lesson date, so a lesson taken before a package expired can
 * still use it when invoices are generated later.
 *
 * Callers pass only billable lessons that are not already invoiced or
 * redeemed. Returns lessonId → packageId for the lessons a credit covers.
 */
export function allocateCredits(
  lessons: CreditCandidate[],
  packages: CreditPackageInput[]
): Map<string, string> {
  const remaining = new Map(
    packages.map((p) => [p.id, Math.max(0, p.credits - p.usedCredits)])
  );
  const ordered = [...packages].sort(comparePackages);
  const sortedLessons = [...lessons].sort((a, b) =>
    a.startsAt === b.startsAt
      ? a.lessonId.localeCompare(b.lessonId)
      : a.startsAt < b.startsAt
        ? -1
        : 1
  );

  const allocation = new Map<string, string>();
  for (const lesson of sortedLessons) {
    const pkg = ordered.find(
      (p) => (remaining.get(p.id) ?? 0) > 0 && packageCoversLesson(p, lesson)
    );
    if (!pkg) continue;
    allocation.set(lesson.lessonId, pkg.id);
    remaining.set(pkg.id, (remaining.get(pkg.id) ?? 0) - 1);
  }
  return allocation;
}

export type CreditPackageState = "pending" | "active" | "used_up" | "expired";

export interface CreditPackageBalance {
  packageId: string;
  /** Written to the ledger. */
  usedCredits: number;
  /** Marked lessons waiting for the next invoice run that will use a credit. */
  pendingCredits: number;
  /** credits − used − pending, never negative. */
  remainingCredits: number;
  state: CreditPackageState;
}

/**
 * Balance per package as of `today`, counting lessons that are marked but
 * not yet invoiced (`pending`, from allocateCredits) as already spent, so the
 * teacher and the family see what is really left.
 */
export function summarizeCreditBalances(
  packages: CreditPackageInput[],
  pending: Map<string, string>,
  today: string
): CreditPackageBalance[] {
  const pendingByPackage = new Map<string, number>();
  for (const packageId of pending.values()) {
    pendingByPackage.set(packageId, (pendingByPackage.get(packageId) ?? 0) + 1);
  }

  return packages.map((pkg) => {
    const pendingCredits = pendingByPackage.get(pkg.id) ?? 0;
    const remainingCredits = Math.max(
      0,
      pkg.credits - pkg.usedCredits - pendingCredits
    );
    let state: CreditPackageState;
    if (!pkg.active) state = "pending";
    else if (remainingCredits === 0) state = "used_up";
    else if (pkg.expiresOn != null && pkg.expiresOn < today) state = "expired";
    else state = "active";
    return {
      packageId: pkg.id,
      usedCredits: pkg.usedCredits,
      pendingCredits,
      remainingCredits,
      state,
    };
  });
}

/** e.g. "10 × 30-min lessons" */
export function describeCreditPackage(
  credits: number,
  durationMinutes: number
): string {
  return `${credits} × ${durationMinutes}-min lesson${credits === 1 ? "" : "s"}`;
}

export interface CreditPackageRequest {
  credits: number;
  durationMinutes: number;
  priceCents: number;
  startsOn: string;
  expiresOn: string | null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const MAX_PACKAGE_CREDITS = 200;

/** Validate a "sell a package" request. Returns an error message or null. */
export function validateCreditPackage(req: CreditPackageRequest): string | null {
  if (
    !Number.isInteger(req.credits) ||
    req.credits < 1 ||
    req.credits > MAX_PACKAGE_CREDITS
  ) {
    return `Credits must be a whole number from 1 to ${MAX_PACKAGE_CREDITS}`;
  }
  if (
    !Number.isInteger(req.durationMinutes) ||
    req.durationMinutes < 5 ||
    req.durationMinutes > 480
  ) {
    return "Choose a lesson length";
  }
  if (!Number.isInteger(req.priceCents) || req.priceCents < 0) {
    return "Enter a package price";
  }
  if (!DATE_RE.test(req.startsOn)) {
    return "Choose a start date";
  }
  if (req.expiresOn != null) {
    if (!DATE_RE.test(req.expiresOn)) return "Expiry must be a date";
    if (req.expiresOn < req.startsOn) {
      return "Expiry must be on or after the start date";
    }
  }
  return null;
}
