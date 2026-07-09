"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { StudioPolicy } from "@/lib/schedule";

const inputClass =
  "px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm";

const COMMON_BLOCKS = [15, 20, 30, 45, 60, 90];

export function StudioSettingsForm({ policy }: { policy: StudioPolicy }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [studioName, setStudioName] = useState(policy.studio_name);
  const [studioWebsite, setStudioWebsite] = useState(policy.studio_website);
  const [studioContact, setStudioContact] = useState(policy.studio_contact);
  const [studioInfo, setStudioInfo] = useState(policy.studio_info);
  const [blocks, setBlocks] = useState<number[]>(
    [...policy.lesson_duration_options].sort((a, b) => a - b)
  );
  const [customBlock, setCustomBlock] = useState("");

  const chipChoices = [...new Set([...COMMON_BLOCKS, ...blocks])].sort(
    (a, b) => a - b
  );

  function toggleBlock(minutes: number) {
    setBlocks((prev) =>
      prev.includes(minutes)
        ? prev.filter((b) => b !== minutes)
        : [...prev, minutes].sort((a, b) => a - b)
    );
  }

  function addCustom() {
    const minutes = Number(customBlock);
    if (Number.isInteger(minutes) && minutes >= 5 && minutes <= 240) {
      setBlocks((prev) =>
        prev.includes(minutes) ? prev : [...prev, minutes].sort((a, b) => a - b)
      );
      setCustomBlock("");
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (blocks.length === 0) {
      setMessage("Pick at least one time block");
      setTimeout(() => setMessage(null), 2500);
      return;
    }
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/settings/policy", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studioName,
        studioWebsite,
        studioContact,
        studioInfo,
        lessonDurationOptions: blocks,
      }),
    });
    setBusy(false);
    if (res.ok) {
      setMessage("Saved");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error ?? "Failed to save");
    }
    setTimeout(() => setMessage(null), 2500);
  }

  return (
    <Card padding="sm">
      <h2 className="font-semibold mb-3">Studio</h2>
      <form onSubmit={handleSave} className="flex flex-col gap-4">
        <label className="text-sm">
          <span className="block text-xs font-semibold text-muted mb-1">
            Studio name
          </span>
          <input
            type="text"
            value={studioName}
            onChange={(e) => setStudioName(e.target.value)}
            placeholder="e.g. Morales Piano Studio"
            maxLength={120}
            className={`${inputClass} w-full`}
          />
          <span className="block text-xs text-muted mt-1">
            Shown to families on their portal and in emailed lesson notes.
          </span>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="block text-xs font-semibold text-muted mb-1">
              Studio website
            </span>
            <input
              type="url"
              value={studioWebsite}
              onChange={(e) => setStudioWebsite(e.target.value)}
              placeholder="https://your-studio.com"
              maxLength={300}
              className={`${inputClass} w-full`}
            />
          </label>
          <label className="text-sm">
            <span className="block text-xs font-semibold text-muted mb-1">
              Contact info
            </span>
            <input
              type="text"
              value={studioContact}
              onChange={(e) => setStudioContact(e.target.value)}
              placeholder="e.g. (555) 123-4567 · hello@your-studio.com"
              maxLength={300}
              className={`${inputClass} w-full`}
            />
          </label>
        </div>

        <label className="text-sm">
          <span className="block text-xs font-semibold text-muted mb-1">
            Studio info
          </span>
          <textarea
            value={studioInfo}
            onChange={(e) => setStudioInfo(e.target.value)}
            placeholder={
              "Anything families should know — cancellation policy, make-up rules, tuition, recital dates..."
            }
            rows={4}
            maxLength={5000}
            className={`${inputClass} w-full resize-y`}
          />
          <span className="block text-xs text-muted mt-1">
            Shown on the family portal along with your website and contact info.
          </span>
        </label>

        <fieldset>
          <legend className="text-xs font-semibold text-muted mb-1">
            Lesson time blocks
          </legend>
          <div className="flex flex-wrap gap-2 mb-2">
            {chipChoices.map((minutes) => {
              const active = blocks.includes(minutes);
              return (
                <button
                  key={minutes}
                  type="button"
                  onClick={() => toggleBlock(minutes)}
                  className={`px-3 py-1.5 rounded-full text-sm border cursor-pointer transition-colors ${
                    active
                      ? "bg-primary text-white border-primary"
                      : "bg-background text-muted border-border hover:border-primary/50"
                  }`}
                >
                  {minutes} min
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={5}
              max={240}
              step={5}
              placeholder="Custom"
              value={customBlock}
              onChange={(e) => setCustomBlock(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustom();
                }
              }}
              className={`${inputClass} w-24`}
            />
            <Button type="button" size="sm" variant="secondary" onClick={addCustom}>
              Add
            </Button>
          </div>
          <span className="block text-xs text-muted mt-1">
            These durations are offered when creating weekly slots and one-off
            lessons.
          </span>
        </fieldset>

        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={busy}>
            {busy ? "Saving..." : "Save Studio Settings"}
          </Button>
          {message && <span className="text-xs text-muted">{message}</span>}
        </div>
      </form>
    </Card>
  );
}
