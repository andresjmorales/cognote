"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CopyLinkClient } from "@/components/teacher/CopyLinkClient";
import {
  FamilyForm,
  type FamilyGuardian,
  type FamilyStudent,
} from "@/components/teacher/FamilyForm";
import { familyDisplayName } from "@/lib/guardians";

export function FamiliesManager({
  guardians,
  students,
}: {
  guardians: FamilyGuardian[];
  students: FamilyStudent[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<FamilyGuardian | null>(null);

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

  return (
    <div>
      {editing === null ? (
        <div className="mb-4">
          <Button size="sm" onClick={() => setEditing("new")}>
            Add Family
          </Button>
        </div>
      ) : (
        <FamilyForm
          key={editing}
          guardian={
            editing === "new"
              ? null
              : (guardians.find((g) => g.id === editing) ?? null)
          }
          students={students}
          onClose={() => setEditing(null)}
        />
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
            const primaryContact = [g.email, g.phone].filter(Boolean).join(" · ");
            const contacts = [
              // With an explicit family name, say who the primary contact is
              g.family_name
                ? `${g.name}${primaryContact ? ` — ${primaryContact}` : ""}`
                : primaryContact,
              g.secondary_name
                ? `${g.secondary_name}${
                    [g.secondary_email, g.secondary_phone].filter(Boolean).length > 0
                      ? ` — ${[g.secondary_email, g.secondary_phone].filter(Boolean).join(" · ")}`
                      : ""
                  }`
                : null,
            ].filter(Boolean);
            return (
              <Card key={g.id} padding="sm">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <Link
                      href={`/families/${g.id}`}
                      className="font-semibold text-lg hover:text-primary transition-colors"
                    >
                      {familyDisplayName(g)}
                    </Link>
                    {contacts.length > 0 ? (
                      contacts.map((line, i) => (
                        <div key={i} className="text-sm text-muted">
                          {line}
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-muted">No contact info</div>
                    )}
                    <div className="text-xs text-muted mt-1">
                      {members.length > 0
                        ? `Students: ${members.map((m) => m.name).join(", ")}`
                        : "No students linked"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <CopyLinkClient
                      url={`/portal/${g.portal_token}`}
                      title="Family portal link"
                      label="Portal Link"
                    />
                    <Button size="sm" variant="secondary" onClick={() => setEditing(g.id)}>
                      Edit
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
            <h3 className="font-semibold mb-2">
              Delete {familyDisplayName(confirmDelete)}?
            </h3>
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
