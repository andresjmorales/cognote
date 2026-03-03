"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  useEffect(() => { document.title = "CogNote - Login"; }, []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();

    try {
      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName } },
        });
        if (signUpError) throw signUpError;

        // In local dev, Supabase auto-confirms. Sign in to get a session.
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;

        // Create (or adopt) the teacher row server-side
        await fetch("/api/auth/setup-teacher", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ displayName: displayName || email.split("@")[0] }),
        });
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;

        // Ensure teacher row exists (handles first sign-in after seed)
        await fetch("/api/auth/setup-teacher", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ displayName: email.split("@")[0] }),
        });
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      const msg = err.message ?? "Something went wrong";
      if (msg.toLowerCase().includes("email not confirmed")) {
        setError("Please check your email and click the confirmation link to activate your account.");
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
            {isSignUp ? "Create your teacher account" : "Sign in to your dashboard"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {isSignUp && (
            <input
              type="text"
              placeholder="Your name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              required
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            required
            minLength={6}
          />

          {error && (
            <p className="text-error text-sm text-center">{error}</p>
          )}

          <Button type="submit" size="lg" disabled={loading} className="w-full">
            {loading ? "..." : isSignUp ? "Create Account" : "Sign In"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted mt-4">
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            type="button"
            className="text-primary font-semibold hover:underline cursor-pointer"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
            }}
          >
            {isSignUp ? "Sign in" : "Sign up"}
          </button>
        </p>
      </Card>
    </div>
  );
}
