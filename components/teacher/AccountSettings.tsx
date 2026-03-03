"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function AccountSettings({ initialName }: { initialName: string }) {
  const router = useRouter();

  const [name, setName] = useState(initialName);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameMessage, setNameMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMessage, setPwMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleNameSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setNameSaving(true);
    setNameMessage(null);

    try {
      const res = await fetch("/api/auth/update-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: name.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        setNameMessage({ type: "error", text: data.error ?? "Failed to update name" });
      } else {
        setNameMessage({ type: "success", text: "Name updated" });
        router.refresh();
      }
    } catch {
      setNameMessage({ type: "error", text: "Something went wrong" });
    } finally {
      setNameSaving(false);
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPwMessage(null);

    if (newPassword.length < 6) {
      setPwMessage({ type: "error", text: "New password must be at least 6 characters" });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwMessage({ type: "error", text: "Passwords don't match" });
      return;
    }

    setPwSaving(true);

    try {
      const supabase = createClient();

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: (await supabase.auth.getUser()).data.user?.email ?? "",
        password: currentPassword,
      });

      if (signInError) {
        setPwMessage({ type: "error", text: "Current password is incorrect" });
        setPwSaving(false);
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        setPwMessage({ type: "error", text: error.message });
      } else {
        setPwMessage({ type: "success", text: "Password updated" });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      setPwMessage({ type: "error", text: "Something went wrong" });
    } finally {
      setPwSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Display Name */}
      <Card padding="lg">
        <h2 className="text-lg font-semibold mb-4">Profile</h2>
        <form onSubmit={handleNameSave} className="space-y-3">
          <div>
            <label htmlFor="displayName" className="text-sm font-medium block mb-1">
              Display Name
            </label>
            <input
              id="displayName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              required
            />
          </div>
          {nameMessage && (
            <p className={`text-sm ${nameMessage.type === "success" ? "text-success" : "text-error"}`}>
              {nameMessage.text}
            </p>
          )}
          <Button type="submit" size="sm" disabled={nameSaving || name.trim() === initialName}>
            {nameSaving ? "Saving..." : "Save Name"}
          </Button>
        </form>
      </Card>

      {/* Change Password */}
      <Card padding="lg">
        <h2 className="text-lg font-semibold mb-4">Change Password</h2>
        <form onSubmit={handlePasswordChange} className="space-y-3">
          <div>
            <label htmlFor="currentPassword" className="text-sm font-medium block mb-1">
              Current Password
            </label>
            <input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              required
            />
          </div>
          <div>
            <label htmlFor="newPassword" className="text-sm font-medium block mb-1">
              New Password
            </label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              required
              minLength={6}
            />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="text-sm font-medium block mb-1">
              Confirm New Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              required
              minLength={6}
            />
          </div>
          {pwMessage && (
            <p className={`text-sm ${pwMessage.type === "success" ? "text-success" : "text-error"}`}>
              {pwMessage.text}
            </p>
          )}
          <Button type="submit" size="sm" disabled={pwSaving || !currentPassword || !newPassword || !confirmPassword}>
            {pwSaving ? "Updating..." : "Change Password"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
