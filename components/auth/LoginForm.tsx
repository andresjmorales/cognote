"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Mode = "signin" | "signup" | "waitlist" | "forgot";

const inputClass =
  "w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40";

export function LoginForm({ betaRequired }: { betaRequired: boolean }) {
  const router = useRouter();
  useEffect(() => {
    document.title = "CogNote - Login";
  }, []);
  const [mode, setMode] = useState<Mode>("signin");

  useEffect(() => {
    const message = new URLSearchParams(window.location.search).get("message");
    if (message) {
      setError(message);
      window.history.replaceState(null, "", "/login");
    }
  }, []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function switchMode(next: Mode) {
    if (next === "waitlist" && !betaRequired) {
      setMode("signup");
      return;
    }
    setMode(next);
    setError(null);
    setInfo(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    try {
      if (mode === "waitlist") {
        const res = await fetch("/api/auth/waitlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Something went wrong");
        setInfo("You're on the list! We'll email you when a spot opens up.");
        return;
      }

      if (mode === "forgot") {
        const supabase = createClient();
        await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/confirm?next=/reset-password`,
        });
        setInfo(
          "If an account exists for that email, a password reset link is on its way. Open it in this browser."
        );
        return;
      }

      if (mode === "signup") {
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            password,
            displayName: displayName || email.split("@")[0],
            accessCode: betaRequired ? accessCode : undefined,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Something went wrong");
        if (data.needsConfirmation) {
          setInfo(
            "Check your email and click the confirmation link to activate your account."
          );
          return;
        }
      } else {
        const supabase = createClient();
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;

        await fetch("/api/auth/setup-teacher", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            displayName: email.split("@")[0],
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }),
        });
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Something went wrong";
      if (msg.toLowerCase().includes("email not confirmed")) {
        setError(
          "Please check your email and click the confirmation link to activate your account."
        );
      } else if (
        msg === "Failed to fetch" ||
        /networkerror|fetch failed|load failed/i.test(msg)
      ) {
        setError(
          "Can't reach the auth server. Check your connection — and if you're running locally, start Docker Desktop then run npx supabase start."
        );
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card padding="lg" className="max-w-sm w-full">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-primary">CogNote</h1>
          <p className="text-muted text-sm mt-1">
            {mode === "signin" && "Sign in to your dashboard"}
            {mode === "signup" && "Create your teacher account"}
            {mode === "waitlist" && "Join the beta waitlist"}
            {mode === "forgot" && "Reset your password"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === "signup" && (
            <input
              type="text"
              placeholder="Your name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={inputClass}
              required
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            required
          />
          {mode !== "waitlist" && mode !== "forgot" && (
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              required
              minLength={6}
            />
          )}
          {mode === "signin" && (
            <p className="text-xs text-right -mt-2">
              <button
                type="button"
                className="text-muted hover:text-primary transition-colors cursor-pointer"
                onClick={() => switchMode("forgot")}
              >
                Forgot password?
              </button>
            </p>
          )}
          {mode === "forgot" && (
            <p className="text-xs text-muted -mt-2">
              Enter your account email and we&apos;ll send you a link to choose a
              new password.
            </p>
          )}
          {mode === "signup" && betaRequired && (
            <div>
              <input
                type="text"
                placeholder="Beta access code"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                className={inputClass}
                required
              />
              <p className="text-xs text-muted mt-1.5">
                No code?{" "}
                <button
                  type="button"
                  className="text-primary font-semibold hover:underline cursor-pointer"
                  onClick={() => switchMode("waitlist")}
                >
                  Join the waitlist
                </button>
              </p>
            </div>
          )}
          {mode === "waitlist" && betaRequired && (
            <p className="text-xs text-muted -mt-2">
              CogNote Studio is in private beta. Leave your email and we&apos;ll
              reach out when a spot opens up.
            </p>
          )}

          {error && <p className="text-error text-sm text-center">{error}</p>}
          {info && <p className="text-primary text-sm text-center">{info}</p>}

          <Button type="submit" size="lg" disabled={loading} className="w-full">
            {loading
              ? "..."
              : mode === "signin"
                ? "Sign In"
                : mode === "signup"
                  ? "Create Account"
                  : mode === "forgot"
                    ? "Send Reset Link"
                    : "Join Waitlist"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted mt-4">
          {mode === "signin" ? (
            <>
              Don&apos;t have an account?{" "}
              <button
                type="button"
                className="text-primary font-semibold hover:underline cursor-pointer"
                onClick={() => switchMode("signup")}
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                className="text-primary font-semibold hover:underline cursor-pointer"
                onClick={() => switchMode("signin")}
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </Card>
    </div>
  );
}
