const TEACHER_ROUTE_PREFIXES = [
  "/dashboard",
  "/students",
  "/lessons",
  "/families",
  "/schedule",
  "/settings",
  "/studio",
  "/account",
  "/billing",
  "/events",
  "/music",
  "/help",
] as const;

export type SessionGateDecision = "next" | "login" | "dashboard";

export function isTeacherRoute(pathname: string): boolean {
  return TEACHER_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function isLoginOrLanding(pathname: string): boolean {
  return pathname === "/login" || pathname === "/";
}

/**
 * When Auth is unreachable, public pages still load and teacher routes go to
 * login instead of hanging on getUser().
 */
export function resolveSessionGate(input: {
  pathname: string;
  hasUser: boolean;
  authUnreachable: boolean;
}): SessionGateDecision {
  if (input.authUnreachable) {
    return isTeacherRoute(input.pathname) ? "login" : "next";
  }
  if (!input.hasUser && isTeacherRoute(input.pathname)) return "login";
  if (input.hasUser && isLoginOrLanding(input.pathname)) return "dashboard";
  return "next";
}
