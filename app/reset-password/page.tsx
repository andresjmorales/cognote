"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const inputClass =
  "w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40";

export default function ResetPasswordPage() {
  const router = useRouter();
  useEffect(() => {
    document.title = "CogNote - Reset Password";
  }, []);

  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setHasSession(Boolean(user));
      setChecking(false);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card padding="lg" className="max-w-sm w-full">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-primary">CogNote</h1>
          <p className="text-muted text-sm mt-1">Choose a new password</p>
        </div>

        {checking ? (
          <p className="text-center text-muted text-sm">Checking your link...</p>
        ) : !hasSession ? (
          <div className="text-center text-sm space-y-3">
            <p className="text-error">
              This reset link is invalid or has expired.
            </p>
            <p className="text-muted">
              <Link href="/login" className="text-primary font-semibold hover:underline">
                Back to sign in
              </Link>{" "}
              to request a new one.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              required
              minLength={6}
              autoFocus
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={inputClass}
              required
              minLength={6}
            />
            {error && <p className="text-error text-sm text-center">{error}</p>}
            <Button type="submit" size="lg" disabled={saving} className="w-full">
              {saving ? "..." : "Set New Password"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
