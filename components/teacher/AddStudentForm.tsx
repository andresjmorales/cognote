"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function AddStudentForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [parentContact, setParentContact] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Not authenticated");
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from("students").insert({
      teacher_id: user.id,
      name: name.trim(),
      parent_contact: parentContact.trim() || null,
    });

    if (insertError) {
      setError(insertError.message);
    } else {
      setName("");
      setParentContact("");
      router.refresh();
    }

    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <input
        type="text"
        placeholder="Student name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm"
        required
      />
      <input
        type="text"
        placeholder="Parent contact (optional)"
        value={parentContact}
        onChange={(e) => setParentContact(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm"
      />
      {error && <p className="text-error text-xs">{error}</p>}
      <Button type="submit" size="sm" disabled={loading}>
        {loading ? "Adding..." : "Add Student"}
      </Button>
    </form>
  );
}
