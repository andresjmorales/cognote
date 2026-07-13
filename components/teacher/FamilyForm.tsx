"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { EmailRecipients } from "@/lib/supabase/types";

export interface FamilyGuardian {
  id: string;
  name: string;
  family_name: string | null;
  email: string | null;
  phone: string | null;
  secondary_name: string | null;
  secondary_email: string | null;
  secondary_phone: string | null;
  email_recipients: EmailRecipients;
  portal_token: string;
}

export interface FamilyStudent {
  id: string;
  name: string;
  guardian_id: string | null;
}

interface NewStudentDraft {
  name: string;
  birthdate: string;
}

const inputClass =
  "w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm";

/**
 * Create/edit form for a family: both guardians, email routing, existing
 * student membership, and inline creation of brand-new students — so
 * onboarding a new family is a single form.
 */
export function FamilyForm({
  guardian,
  students,
  onClose,
}: {
  /** null = create a new family */
  guardian: FamilyGuardian | null;
  students: FamilyStudent[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(guardian?.name ?? "");
  const [familyName, setFamilyName] = useState(guardian?.family_name ?? "");
  const [email, setEmail] = useState(guardian?.email ?? "");
  const [phone, setPhone] = useState(guardian?.phone ?? "");
  const [secondaryName, setSecondaryName] = useState(guardian?.secondary_name ?? "");
  const [secondaryEmail, setSecondaryEmail] = useState(guardian?.secondary_email ?? "");
  const [secondaryPhone, setSecondaryPhone] = useState(guardian?.secondary_phone ?? "");
  const [emailRecipients, setEmailRecipients] = useState<EmailRecipients>(
    guardian?.email_recipients ?? "primary"
  );
  const [showSecondary, setShowSecondary] = useState(
    !!(guardian?.secondary_name || guardian?.secondary_email || guardian?.secondary_phone)
  );
  const [memberIds, setMemberIds] = useState<string[]>(
    guardian ? students.filter((s) => s.guardian_id === guardian.id).map((s) => s.id) : []
  );
  const [newStudents, setNewStudents] = useState<NewStudentDraft[]>([]);

  function toggleMember(studentId: string) {
    setMemberIds((ids) =>
      ids.includes(studentId)
        ? ids.filter((id) => id !== studentId)
        : [...ids, studentId]
    );
  }

  function updateNewStudent(index: number, patch: Partial<NewStudentDraft>) {
    setNewStudents((drafts) =>
      drafts.map((d, i) => (i === index ? { ...d, ...patch } : d))
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);

    const payload = {
      name: name.trim(),
      familyName: familyName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      secondaryName: secondaryName.trim(),
      secondaryEmail: secondaryEmail.trim(),
      secondaryPhone: secondaryPhone.trim(),
      emailRecipients,
      studentIds: memberIds,
      newStudents: newStudents
        .filter((s) => s.name.trim())
        .map((s) => ({ name: s.name.trim(), birthdate: s.birthdate || null })),
    };
    const res = guardian
      ? await fetch(`/api/guardians/${guardian.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch("/api/guardians", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
      setBusy(false);
    } else {
      setBusy(false);
      onClose();
      router.refresh();
    }
  }

  const hasSecondaryEmail = !!secondaryEmail.trim();

  return (
    <Card padding="sm" className="mb-4">
      <form onSubmit={handleSave} className="flex flex-col gap-3">
        <h3 className="font-semibold">{guardian ? "Edit Family" : "New Family"}</h3>

        <div>
          <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
            Family Name
          </p>
          <input
            type="text"
            placeholder="e.g. The Parker Family (optional; defaults to the guardian's name)"
            value={familyName}
            onChange={(e) => setFamilyName(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
            Guardian
          </p>
          <div className="flex flex-col gap-3">
            <input
              type="text"
              placeholder="Guardian name (e.g. Jordan Parent)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              required
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="email"
                placeholder="Email (for lesson notes & invoices)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
              <input
                type="tel"
                placeholder="Phone (optional)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {showSecondary ? (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-muted uppercase tracking-wide">
                Second Guardian
              </p>
              <button
                type="button"
                onClick={() => {
                  setShowSecondary(false);
                  setSecondaryName("");
                  setSecondaryEmail("");
                  setSecondaryPhone("");
                  setEmailRecipients("primary");
                }}
                className="text-xs text-muted hover:text-error underline cursor-pointer"
              >
                Remove
              </button>
            </div>
            <div className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="Second guardian name"
                value={secondaryName}
                onChange={(e) => setSecondaryName(e.target.value)}
                className={inputClass}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="email"
                  placeholder="Email (optional)"
                  value={secondaryEmail}
                  onChange={(e) => setSecondaryEmail(e.target.value)}
                  className={inputClass}
                />
                <input
                  type="tel"
                  placeholder="Phone (optional)"
                  value={secondaryPhone}
                  onChange={(e) => setSecondaryPhone(e.target.value)}
                  className={inputClass}
                />
              </div>
              {hasSecondaryEmail && (
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-xs font-semibold text-muted uppercase tracking-wide">
                    Who gets family emails?
                  </span>
                  <select
                    value={emailRecipients}
                    onChange={(e) =>
                      setEmailRecipients(e.target.value as EmailRecipients)
                    }
                    className={inputClass}
                  >
                    <option value="primary">Only {name.trim() || "the first guardian"} (default)</option>
                    <option value="secondary">Only {secondaryName.trim() || "the second guardian"}</option>
                    <option value="both">Always email both</option>
                  </select>
                </label>
              )}
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowSecondary(true)}
            className="self-start text-sm text-primary hover:underline cursor-pointer"
          >
            + Add second guardian
          </button>
        )}

        <div>
          <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
            Students in this family
          </p>
          {students.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {students.map((s) => {
                const selected = memberIds.includes(s.id);
                const inOtherFamily =
                  s.guardian_id && s.guardian_id !== guardian?.id && !selected;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleMember(s.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition-colors cursor-pointer ${
                      selected
                        ? "bg-primary/10 border-primary text-primary font-medium"
                        : "border-border text-muted hover:text-foreground hover:bg-surface-dim"
                    }`}
                    title={
                      inOtherFamily
                        ? "Currently in another family; selecting moves them here"
                        : undefined
                    }
                  >
                    {s.name}
                    {inOtherFamily && " *"}
                  </button>
                );
              })}
            </div>
          )}
          {newStudents.map((draft, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto_auto] gap-2 items-center mb-2">
              <input
                type="text"
                placeholder="New student name"
                value={draft.name}
                onChange={(e) => updateNewStudent(i, { name: e.target.value })}
                className={inputClass}
              />
              <input
                type="date"
                title="Birthday (optional)"
                value={draft.birthdate}
                onChange={(e) => updateNewStudent(i, { birthdate: e.target.value })}
                className={inputClass}
              />
              <button
                type="button"
                onClick={() =>
                  setNewStudents((drafts) => drafts.filter((_, j) => j !== i))
                }
                className="text-muted hover:text-error cursor-pointer text-lg leading-none px-1"
                aria-label="Remove new student"
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setNewStudents((drafts) => [...drafts, { name: "", birthdate: "" }])
            }
            className="text-sm text-primary hover:underline cursor-pointer"
          >
            + New student
          </button>
          {newStudents.length > 0 && (
            <p className="text-xs text-muted mt-1">
              Birthday is optional. New students are created and linked to this
              family when you save.
            </p>
          )}
        </div>

        {error && <p className="text-error text-xs">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={busy}>
            {busy ? "Saving..." : "Save Family"}
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
