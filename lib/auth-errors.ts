export const AUTH_REQUEST_TIMEOUT_MS = 10_000;

export type AuthFormAction = "signin" | "signup" | "forgot" | "waitlist";

export type AuthFormError = {
  headline: string;
  detail?: string;
};

const REACHABILITY_HEADLINE: Record<AuthFormAction, string> = {
  signin: "Can't sign in right now",
  signup: "Can't create your account right now",
  forgot: "Can't send a reset email right now",
  waitlist: "Can't join the waitlist right now",
};

const REACHABILITY_DETAIL_SHARED =
  "Can't reach CogNote's auth service. Check your connection, try another network or turn off VPN (school/work filters sometimes block it).";

const REACHABILITY_DETAIL_LOCAL =
  " If you're developing locally, start Docker Desktop then run npx supabase start.";

export function isAuthUnreachableMessage(message: string): boolean {
  const msg = message.toLowerCase();
  return (
    message === "Failed to fetch" ||
    msg === "failed to fetch" ||
    /networkerror|fetch failed|load failed|network error|auth service timed out|abort/i.test(
      message
    )
  );
}

export function isLocalHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

export function authReachabilityDetail(isLocal: boolean): string {
  return isLocal
    ? REACHABILITY_DETAIL_SHARED + REACHABILITY_DETAIL_LOCAL
    : REACHABILITY_DETAIL_SHARED;
}

export function authFormErrorFromUnknown(
  err: unknown,
  options: { isLocal?: boolean; action?: AuthFormAction } = {}
): AuthFormError {
  const action = options.action ?? "signin";
  const message = err instanceof Error ? err.message : "Something went wrong";

  if (message.toLowerCase().includes("email not confirmed")) {
    return {
      headline:
        "Please check your email and click the confirmation link to activate your account.",
    };
  }

  if (isAuthUnreachableMessage(message)) {
    return {
      headline: REACHABILITY_HEADLINE[action],
      detail: authReachabilityDetail(Boolean(options.isLocal)),
    };
  }

  return { headline: message };
}

export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number = AUTH_REQUEST_TIMEOUT_MS,
  label = "Auth service timed out"
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(label)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
