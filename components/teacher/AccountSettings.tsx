"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ProfilePhotoField } from "@/components/avatar/ProfilePhotoField";
import { TimezoneSettingsForm } from "@/components/teacher/settings/TimezoneSettingsForm";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const inputClass =
  "w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40";

export function AccountSettings({
  initialName,
  initialAvatarUrl,
  currentEmail,
  memberSinceLabel,
  timezone,
  children,
}: {
  initialName: string;
  initialAvatarUrl: string | null;
  currentEmail: string;
  memberSinceLabel: string;
  timezone: string;
  /** Rendered between Profile and Password (e.g. hosting plan). */
  children?: ReactNode;
}) {
  const router = useRouter();

  const [name, setName] = useState(initialName);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameMessage, setNameMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [emailOpen, setEmailOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMessage, setEmailMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMessage, setPwMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function closeEmailForm() {
    setEmailOpen(false);
    setNewEmail("");
    setEmailMessage(null);
  }

  function closePasswordForm() {
    setPasswordOpen(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPwMessage(null);
  }

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

  async function handleEmailChange(e: React.FormEvent) {
    e.preventDefault();
    setEmailMessage(null);

    const email = newEmail.trim();
    if (!email || email === currentEmail) {
      setEmailMessage({ type: "error", text: "Enter a new email address" });
      return;
    }

    setEmailSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser(
        { email },
        { emailRedirectTo: `${window.location.origin}/auth/confirm?next=/account` }
      );
      if (error) {
        setEmailMessage({ type: "error", text: error.message });
      } else {
        setEmailMessage({
          type: "success",
          text: "Check both inboxes to confirm the change.",
        });
        setNewEmail("");
      }
    } catch {
      setEmailMessage({ type: "error", text: "Something went wrong" });
    } finally {
      setEmailSaving(false);
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
        setPasswordOpen(false);
      }
    } catch {
      setPwMessage({ type: "error", text: "Something went wrong" });
    } finally {
      setPwSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card padding="lg">
        <div className="flex items-start justify-between gap-3 mb-5">
          <h2 className="text-lg font-semibold">Profile</h2>
          <div className="text-right shrink-0">
            <div className="text-xs text-muted">Member since</div>
            <div className="text-sm font-medium">{memberSinceLabel}</div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="flex items-start gap-4">
            <ProfilePhotoField
              initialUrl={initialAvatarUrl}
              displayName={name || initialName}
              onUrlChange={() => router.refresh()}
            />
            <form onSubmit={handleNameSave} className="flex-1 min-w-0 space-y-2 pt-0.5">
              <div>
                <label htmlFor="displayName" className="text-sm font-medium block mb-1">
                  Display name
                </label>
                <input
                  id="displayName"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>
              {nameMessage && (
                <p className={`text-sm ${nameMessage.type === "success" ? "text-success" : "text-error"}`}>
                  {nameMessage.text}
                </p>
              )}
              <Button type="submit" size="sm" disabled={nameSaving || name.trim() === initialName}>
                {nameSaving ? "Saving..." : "Save name"}
              </Button>
            </form>
          </div>

          <div className="pt-1 border-t border-border space-y-3">
            <div className="flex items-start justify-between gap-3 pt-4">
              <div className="min-w-0 text-sm">
                <div className="text-xs text-muted mb-0.5">Email</div>
                <div className="font-medium break-all">{currentEmail}</div>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (emailOpen) closeEmailForm();
                  else {
                    setEmailOpen(true);
                    setEmailMessage(null);
                  }
                }}
                aria-expanded={emailOpen}
              >
                {emailOpen ? "Cancel" : "Change"}
              </Button>
            </div>

            {emailOpen && (
              <form onSubmit={handleEmailChange} className="space-y-3">
                <div>
                  <label htmlFor="newEmail" className="text-sm font-medium block mb-1">
                    New email
                  </label>
                  <input
                    id="newEmail"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder={currentEmail}
                    className={inputClass}
                    required
                    autoFocus
                  />
                  <p className="text-xs text-muted mt-1.5">
                    Confirmations go to both addresses.
                  </p>
                </div>
                {emailMessage && (
                  <p className={`text-sm ${emailMessage.type === "success" ? "text-success" : "text-error"}`}>
                    {emailMessage.text}
                  </p>
                )}
                <Button type="submit" size="sm" disabled={emailSaving || !newEmail.trim()}>
                  {emailSaving ? "Sending..." : "Send confirmation"}
                </Button>
              </form>
            )}
          </div>

          <div className="pt-1 border-t border-border">
            <div className="pt-4">
              <TimezoneSettingsForm timezone={timezone} embedded />
            </div>
          </div>
        </div>
      </Card>

      {children}

      <Card padding="lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Password</h2>
            {!passwordOpen && (
              <p className="text-sm text-muted mt-1">Update your sign-in password.</p>
            )}
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              if (passwordOpen) closePasswordForm();
              else setPasswordOpen(true);
            }}
            aria-expanded={passwordOpen}
          >
            {passwordOpen ? "Cancel" : "Change"}
          </Button>
        </div>

        {passwordOpen && (
          <form onSubmit={handlePasswordChange} className="space-y-3 mt-4">
            <div>
              <label htmlFor="currentPassword" className="text-sm font-medium block mb-1">
                Current password
              </label>
              <input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={inputClass}
                required
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="newPassword" className="text-sm font-medium block mb-1">
                New password
              </label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={inputClass}
                required
                minLength={6}
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="text-sm font-medium block mb-1">
                Confirm new password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClass}
                required
                minLength={6}
              />
            </div>
            {pwMessage && (
              <p className={`text-sm ${pwMessage.type === "success" ? "text-success" : "text-error"}`}>
                {pwMessage.text}
              </p>
            )}
            <Button
              type="submit"
              size="sm"
              disabled={pwSaving || !currentPassword || !newPassword || !confirmPassword}
            >
              {pwSaving ? "Updating..." : "Update password"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
