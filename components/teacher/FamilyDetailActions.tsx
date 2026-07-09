"use client";

import { useState } from "react";
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

/**
 * Action row + inline edit form for the family detail page. Server
 * components re-render via router.refresh() after mutations.
 */
export function FamilyDetailActions({
  guardian,
  students,
}: {
  guardian: FamilyGuardian;
  students: FamilyStudent[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleRotate() {
    setBusy(true);
    const res = await fetch(`/api/guardians/${guardian.id}/rotate-token`, {
      method: "POST",
    });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  async function handleDelete() {
    setBusy(true);
    const res = await fetch(`/api/guardians/${guardian.id}`, { method: "DELETE" });
    setBusy(false);
    setConfirmDelete(false);
    if (res.ok) {
      router.push("/families");
      router.refresh();
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <CopyLinkClient
          url={`/portal/${guardian.portal_token}`}
          title="Family portal link"
          label="Portal Link"
        />
        <Button size="sm" variant="secondary" onClick={() => setEditing((v) => !v)}>
          {editing ? "Close Editor" : "Edit Family"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={handleRotate}
          title="Generate a new family portal link — the old one stops working"
        >
          Reset Portal Link
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-error"
          onClick={() => setConfirmDelete(true)}
        >
          Delete Family
        </Button>
      </div>

      {editing && (
        <FamilyForm
          guardian={guardian}
          students={students}
          onClose={() => setEditing(false)}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-sm w-full">
            <h3 className="font-semibold mb-2">
              Delete {familyDisplayName(guardian)}?
            </h3>
            <p className="text-sm text-muted mb-4">
              The portal link stops working and students are unlinked from this
              family. Students and their practice history are kept.
            </p>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="secondary" onClick={() => setConfirmDelete(false)}>
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
