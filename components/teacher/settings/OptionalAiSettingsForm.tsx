"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { StudioPolicy } from "@/lib/schedule";

const inputClass =
  "px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm w-full";

type AiProvider = StudioPolicy["ai_provider"];

export function OptionalAiSettingsForm({
  policy,
  aiStatus,
}: {
  policy: StudioPolicy;
  aiStatus: { configured: boolean; masked: string | null };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [provider, setProvider] = useState<AiProvider>(
    policy.ai_provider ?? "none"
  );
  const [apiKey, setApiKey] = useState("");
  const [clearKey, setClearKey] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/settings/policy", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        aiProvider: provider,
        ...(apiKey.trim() && { aiApiKey: apiKey.trim() }),
        ...(clearKey && { clearAiApiKey: true }),
      }),
    });
    setBusy(false);
    if (res.ok) {
      setMessage("Saved");
      setApiKey("");
      setClearKey(false);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error ?? "Failed to save");
    }
    setTimeout(() => setMessage(null), 2500);
  }

  return (
    <Card padding="sm">
      <h2 className="font-semibold mb-1">Optional AI</h2>
      <p className="text-sm text-muted mb-3">
        Bring your own API key if you want assist features (for example,
        suggesting spreadsheet column mapping). Everything works without this.
        Keys stay on your studio settings; CogNote does not provide a shared
        key.
      </p>
      <form onSubmit={handleSave} className="flex flex-col gap-3">
        <fieldset>
          <legend className="text-xs font-semibold text-muted mb-1">
            Provider
          </legend>
          <div className="space-y-1.5 text-sm">
            {(
              [
                ["none", "Off"],
                ["openai", "OpenAI"],
                ["anthropic", "Anthropic"],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="radio"
                  name="aiProvider"
                  checked={provider === value}
                  onChange={() => setProvider(value)}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        {provider !== "none" && (
          <div className="space-y-2">
            <label className="block text-xs font-medium text-muted">
              API key
              {aiStatus.configured && (
                <span className="ml-2 font-normal">
                  (saved: {aiStatus.masked})
                </span>
              )}
            </label>
            <input
              type="password"
              autoComplete="off"
              placeholder={
                aiStatus.configured ? "Paste to replace" : "Paste API key"
              }
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setClearKey(false);
              }}
              className={inputClass}
            />
            {aiStatus.configured && (
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={clearKey}
                  onChange={(e) => {
                    setClearKey(e.target.checked);
                    if (e.target.checked) setApiKey("");
                  }}
                />
                Clear saved key
              </label>
            )}
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={busy}>
            {busy ? "Saving…" : "Save AI settings"}
          </Button>
          {message && <span className="text-xs text-muted">{message}</span>}
        </div>
      </form>
    </Card>
  );
}
