"use client";

import { useEffect, useRef, useState } from "react";

interface StaffRendererProps {
  /** When omitted, only clef and key signature are drawn (for key-sig ID quiz). */
  note?: string;
  clef: "treble" | "bass";
  keySignature?: string;
  width?: number;
  height?: number;
}

// VexFlow is imported client-side only (SSR-incompatible) and cached at
// module level so re-renders between questions don't repeat the import.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let vexflowPromise: Promise<any> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadVexFlow(): Promise<any> {
  if (!vexflowPromise) {
    // VexFlow ESM/CJS interop — runtime exports constructors; types do not.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vexflowPromise = import("vexflow").then((VF) => (VF as any).default ?? VF);
  }
  return vexflowPromise;
}

/**
 * Renders a single note on a music staff using VexFlow.
 */
export function StaffRenderer({
  note,
  clef,
  keySignature = "C",
  width = 320,
  height = 250,
}: StaffRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Error state is keyed to the props that failed, so a new question
  // automatically clears the placeholder without extra effect work.
  const propsKey = `${note ?? ""}|${clef}|${keySignature}|${width}|${height}`;
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const drawError = errorKey === propsKey;

  useEffect(() => {
    if (!containerRef.current) return;

    const el = containerRef.current;
    el.innerHTML = "";

    let cancelled = false;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function draw(api: any) {
      const { Renderer, Stave, StaveNote, Formatter, Accidental } = api;

      const renderer = new Renderer(el, Renderer.Backends.SVG);
      renderer.resize(width, height);
      const context = renderer.getContext();

      const stave = new Stave(10, 40, width - 20);
      stave.addClef(clef);
      if (keySignature && keySignature !== "C" && keySignature !== "Am") {
        stave.addKeySignature(keySignature);
      }
      stave.setContext(context).draw();

      if (note != null && note !== "") {
        const { keys, accidental } = parseNoteForVexFlow(note);
        const staveNote = new StaveNote({
          keys,
          duration: "w",
          clef,
        });

        if (accidental) {
          staveNote.addModifier(new Accidental(accidental));
        }

        Formatter.FormatAndDraw(context, stave, [staveNote]);
      }

      const svg = el.querySelector("svg");
      if (svg) {
        svg.style.overflow = "visible";
      }
    }

    // Once the module is cached this resolves in a microtask, before paint,
    // so there's no visible flash between questions.
    loadVexFlow()
      .then((api) => {
        if (cancelled) return;
        try {
          draw(api);
        } catch (err) {
          console.error("StaffRenderer draw failed:", err);
          setErrorKey(propsKey);
        }
      })
      .catch((err) => {
        console.error("Failed to load VexFlow:", err);
        if (!cancelled) setErrorKey(propsKey);
      });

    return () => {
      cancelled = true;
    };
  }, [note, clef, keySignature, width, height, propsKey]);

  if (drawError) {
    return (
      <div
        className="flex items-center justify-center bg-white rounded-xl border border-border text-center text-sm text-muted p-4"
        style={{ minWidth: width, minHeight: height }}
      >
        Couldn&apos;t draw the staff. Try refreshing the page.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex items-center justify-center bg-white rounded-xl border border-border overflow-visible"
      style={{ minWidth: width, minHeight: height }}
    />
  );
}

function parseNoteForVexFlow(note: string): {
  keys: string[];
  accidental?: string;
} {
  const match = note.match(/^([A-Ga-g])([#b]?)(\d)$/);
  if (!match) return { keys: ["c/4"] };

  const letter = match[1].toLowerCase();
  const acc = match[2] || undefined;
  const octave = match[3];

  return {
    keys: [`${letter}/${octave}`],
    accidental: acc,
  };
}
