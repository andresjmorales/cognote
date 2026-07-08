"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CopyLinkClient } from "@/components/teacher/CopyLinkClient";

interface Guardian {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  portal_token: string;
}

interface Student {
  id: string;
  name: string;
  guardian_id: string | null;
}

const inputClass =
  "w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm";

export function FamiliesManager({
  guardians,
  students,
}: {
  guardians: Guardian[];
  students: Student[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Guardian | null>(null);

  // Form state (used for both create and edit)
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);

  function startCreate() {
    setEditing("new");
    setName("");
    setEmail("");
    setPhone("");
    setMemberIds([]);
    setError(null);
  }

  function startEdit(g: Guardian) {
    setEditing(g.id);
    setName(g.name);
    setEmail(g.email ?? "");
    setPhone(g.phone ?? "");
    setMemberIds(students.filter((s) => s.guardian_id === g.id).map((s) => s.id));
    setError(null);
  }

  function toggleMember(studentId: string) {
    setMemberIds((ids) =>
      ids.includes(studentId)
        ? ids.filter((id) => id !== studentId)
        : [...ids, studentId]
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);

    const payload = {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      studentIds: memberIds,
    };
    const res =
      editing === "new"
        ? await fetch("/api/guardians", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch(`/api/guardians/${editing}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
    } else {
      setEditing(null);
      router.refresh();
    }
    setBusy(false);
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setBusy(true);
    const res = await fetch(`/api/guardians/${confirmDelete.id}`, {
      method: "DELETE",
    });
    setBusy(false);
    setConfirmDelete(null);
    if (res.ok) router.refresh();
  }

  async function handleRotate(guardianId: string) {
    setBusy(true);
    const res = await fetch(`/api/guardians/${guardianId}/rotate-token`, {
      method: "POST",
    });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  const form = (
    <Card padding="sm" className="mb-4">
      <form onSubmit={handleSave} className="flex flex-col gap-3">
        <h3 className="font-semibold">
          {editing === "new" ? "New Family" : "Edit Family"}
        </h3>
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
        {students.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
              Students in this family
            </p>
            <div className="flex flex-wrap gap-2">
              {students.map((s) => {
                const selected = memberIds.includes(s.id);
                const inOtherFamily =
                  s.guardian_id && s.guardian_id !== editing && !selected;
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
                        ? "Currently in another family — selecting moves them here"
                        : undefined
                    }
                  >
                    {s.name}
                    {inOtherFamily && " *"}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {error && <p className="text-error text-xs">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={busy}>
            {busy ? "Saving..." : "Save Family"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setEditing(null)}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );

  return (
    <div>
      {editing === null ? (
        <div className="mb-4">
          <Button size="sm" onClick={startCreate}>
            Add Family
          </Button>
        </div>
      ) : (
        form
      )}

      {guardians.length === 0 && editing === null ? (
        <Card className="text-center text-muted py-12">
          <p className="text-lg">No families yet</p>
          <p className="text-sm">
            Add a family, link its students, and share the portal link.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {guardians.map((g) => {
            const members = students.filter((s) => s.guardian_id === g.id);
            return (
              <Card key={g.id} padding="sm">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="font-semibold text-lg">{g.name}</div>
                    <div className="text-sm text-muted">
                      {[g.email, g.phone].filter(Boolean).join(" · ") || "No contact info"}
                    </div>
                    <div className="text-xs text-muted mt-1">
                      {members.length > 0
                        ? `Students: ${members.map((m) => m.name).join(", ")}`
                        : "No students linked"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <CopyLinkClient url={`/portal/${g.portal_token}`} title="Family portal link" />
                    <Button size="sm" variant="secondary" onClick={() => startEdit(g)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => handleRotate(g.id)}
                      title="Generate a new portal link — the old one stops working"
                    >
                      Reset Link
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-error"
                      onClick={() => setConfirmDelete(g)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-sm w-full">
            <h3 className="font-semibold mb-2">Delete {confirmDelete.name}?</h3>
            <p className="text-sm text-muted mb-4">
              The portal link stops working and students are unlinked from this family.
              Students and their practice history are kept.
            </p>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="secondary" onClick={() => setConfirmDelete(null)}>
                Cancel
              </Button>
              <Button size="sm" variant="error" disabled={busy} onClick={handleDelete}>
                {busy ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
