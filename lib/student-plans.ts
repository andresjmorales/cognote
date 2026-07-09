/** Active = not soft-unassigned. Treats missing column (pre-migration) as active. */
export function isActiveStudentPlan(
  sp: { unassigned_at?: string | null } | null | undefined
): boolean {
  return sp != null && sp.unassigned_at == null;
}
