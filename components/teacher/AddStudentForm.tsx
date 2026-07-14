"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const inputClass =
  "w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm";

export function AddStudentForm({
  guardians = [],
}: {
  guardians?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [guardianId, setGuardianId] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactName, setContactName] = useState("");
  const [adultSelf, setAdultSelf] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const linkExisting = Boolean(guardianId);
  const wantsPortal =
    !linkExisting &&
    (adultSelf || Boolean(contactEmail.trim()) || Boolean(contactPhone.trim()));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    if (!linkExisting) {
      const email = contactEmail.trim();
      const phone = contactPhone.trim();
      const parent = contactName.trim();

      if ((email || phone) && !adultSelf && !parent) {
        setError(
          "Parent / guardian name is required unless Adult student is checked"
        );
        return;
      }
      if (parent && !adultSelf && !email && !phone) {
        setError(
          "Add an email or phone for the parent, or check Adult student, or clear the parent name for practice-only"
        );
        return;
      }
    }

    setLoading(true);
    setError(null);

    const res = await fetch("/api/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        birthdate: birthdate || null,
        guardianId: guardianId || null,
        contactEmail: linkExisting ? null : contactEmail.trim() || null,
        contactPhone: linkExisting ? null : contactPhone.trim() || null,
        contactName: linkExisting ? null : contactName.trim() || null,
        adultSelf: linkExisting ? false : adultSelf,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const base = data.error ?? "Failed to add student";
      setError(
        data.code === "HOSTED_LIMIT_REACHED" && data.upgradePath
          ? `${base} See ${data.upgradePath}.`
          : base
      );
      setLoading(false);
      return;
    }

    setName("");
    setGuardianId("");
    setBirthdate("");
    setContactEmail("");
    setContactPhone("");
    setContactName("");
    setAdultSelf(false);
    router.refresh();
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <input
        type="text"
        placeholder="Student name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className={inputClass}
        required
      />
      <select
        value={guardianId}
        onChange={(e) => setGuardianId(e.target.value)}
        className={inputClass}
      >
        <option value="">New contact / family (or none)</option>
        {guardians.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </select>

      {!linkExisting && (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <p className="text-xs text-muted">
            Leave contact blank for practice-only (link a family later). To
            create a portal: check Adult student, or enter a parent name plus
            email or phone.
          </p>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={adultSelf}
              onChange={(e) => setAdultSelf(e.target.checked)}
            />
            Adult student (bills / portal to self)
          </label>
          <input
            type="text"
            placeholder={
              adultSelf
                ? "Contact name (optional; defaults to student)"
                : wantsPortal
                  ? "Parent / guardian name (required)"
                  : "Parent / guardian name"
            }
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            className={inputClass}
            required={wantsPortal && !adultSelf}
          />
          <input
            type="email"
            placeholder="Email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            className={inputClass}
          />
          <input
            type="tel"
            placeholder="Phone"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            className={inputClass}
          />
        </div>
      )}

      <label className="flex flex-col gap-1 text-xs text-muted">
        Birthday (optional)
        <input
          type="date"
          value={birthdate}
          onChange={(e) => setBirthdate(e.target.value)}
          className={inputClass}
        />
      </label>
      {error && <p className="text-error text-xs">{error}</p>}
      <Button type="submit" size="sm" disabled={loading}>
        {loading ? "Adding..." : "Add Student"}
      </Button>
    </form>
  );
}
