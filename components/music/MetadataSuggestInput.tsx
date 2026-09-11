"use client";

import { useEffect, useId, useRef, useState } from "react";
import type {
  MetadataSuggestion,
  SuggestField,
} from "@/lib/music-metadata";

interface MetadataSuggestInputProps {
  field: SuggestField;
  name: string;
  /** Committed value (what submit sends). */
  value: string;
  /** Value to render — may be a hovered suggestion's preview. */
  displayValue: string;
  previewing: boolean;
  onValueChange: (value: string) => void;
  onPreview: (suggestion: MetadataSuggestion | null) => void;
  onApply: (suggestion: MetadataSuggestion) => void;
  /** Used for lookups while the field is still empty (e.g. the filename). */
  fallbackQuery?: string;
  placeholder?: string;
  className: string;
  ariaLabel: string;
  id: string;
}

/** Split a label around the first case-insensitive hit so it can be bolded. */
function highlight(label: string, query: string) {
  const q = query.trim();
  const at = q ? label.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (at < 0) return [label, "", ""] as const;
  return [
    label.slice(0, at),
    label.slice(at, at + q.length),
    label.slice(at + q.length),
  ] as const;
}

export function MetadataSuggestInput({
  field,
  name,
  value,
  displayValue,
  previewing,
  onValueChange,
  onPreview,
  onApply,
  fallbackQuery,
  placeholder,
  className,
  ariaLabel,
  id,
}: MetadataSuggestInputProps) {
  const listId = `${useId()}-listbox`;
  const containerRef = useRef<HTMLDivElement>(null);
  // Results are stored with the query they answer, so a slow response for an
  // older query can never be shown against newer text.
  const [result, setResult] = useState<{
    query: string;
    items: MetadataSuggestion[];
  }>({ query: "", items: [] });
  const [active, setActive] = useState(-1);
  const [focused, setFocused] = useState(false);
  // Set by Escape / after applying, so the list does not immediately reopen
  // for the value we just wrote. Cleared on the next keystroke or arrow key.
  const [dismissed, setDismissed] = useState(false);

  const typed = value.trim();
  const query = typed.length >= 2 ? typed : (fallbackQuery ?? "").trim();
  const wanted = focused && !dismissed && query.length >= 2;
  const items = result.query === query ? result.items : [];
  const open = wanted && items.length > 0;
  const activeIndex = active < items.length ? active : -1;

  useEffect(() => {
    if (!wanted) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/music/suggest?field=${field}&q=${encodeURIComponent(query)}`,
          { signal: controller.signal }
        );
        if (!res.ok) return;
        const data = (await res.json()) as { suggestions?: MetadataSuggestion[] };
        setResult({ query, items: data.suggestions ?? [] });
      } catch {
        // Aborted or offline: the field stays a plain text input.
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [field, query, wanted]);

  function close() {
    setDismissed(true);
    setActive(-1);
    onPreview(null);
  }

  function moveActive(delta: number) {
    setDismissed(false);
    if (!items.length) return;
    const next =
      activeIndex < 0
        ? delta > 0
          ? 0
          : items.length - 1
        : (activeIndex + delta + items.length) % items.length;
    setActive(next);
    onPreview(items[next]);
  }

  function apply(suggestion: MetadataSuggestion) {
    setActive(-1);
    setDismissed(true);
    onApply(suggestion);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      moveActive(e.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (e.key === "Enter" && open && activeIndex >= 0) {
      // Choosing a suggestion must never submit the upload.
      e.preventDefault();
      apply(items[activeIndex]);
      return;
    }
    if (e.key === "Escape" && open) {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative"
      onBlur={(e) => {
        if (containerRef.current?.contains(e.relatedTarget as Node | null)) return;
        setFocused(false);
        setActive(-1);
        onPreview(null);
      }}
    >
      <input
        id={id}
        name={name}
        value={displayValue}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined
        }
        aria-label={ariaLabel}
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        className={`${className} ${
          previewing ? "border-primary bg-primary/5 text-muted italic" : ""
        }`}
        onFocus={() => setFocused(true)}
        onChange={(e) => {
          setDismissed(false);
          setActive(-1);
          onPreview(null);
          onValueChange(e.target.value);
        }}
        onKeyDown={handleKeyDown}
      />

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={`${ariaLabel} suggestions`}
          className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-surface py-1 shadow-lg"
          onMouseLeave={() => {
            setActive(-1);
            onPreview(null);
          }}
        >
          {items.map((suggestion, i) => {
            const [before, hit, after] = highlight(suggestion.label, query);
            return (
              <li key={suggestion.id}>
                <button
                  type="button"
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === activeIndex}
                  // Keep focus in the input so blur does not close the list
                  // before the click lands.
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => {
                    setActive(i);
                    onPreview(suggestion);
                  }}
                  onClick={() => apply(suggestion)}
                  className={`block w-full cursor-pointer px-3 py-2 text-left text-sm ${
                    i === activeIndex ? "bg-primary/10" : ""
                  }`}
                >
                  <span className="block truncate">
                    {before}
                    <span className="font-semibold text-primary">{hit}</span>
                    {after}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                    {suggestion.detail && (
                      <span className="truncate">{suggestion.detail}</span>
                    )}
                    <span className="shrink-0 rounded bg-surface-dim px-1 py-0.5 text-[10px]">
                      {suggestion.sourceLabel}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
