"use client";

import { useEffect, useRef } from "react";

interface StaffRendererProps {
  note: string;
  clef: "treble" | "bass";
  keySignature?: string;
  width?: number;
  height?: number;
}

/**
 * Renders a single note on a music staff using VexFlow.
 * Dynamically imports VexFlow to avoid SSR issues.
 */
export function StaffRenderer({
  note,
  clef,
  keySignature = "C",
  width = 280,
  height = 200,
}: StaffRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const el = containerRef.current;
    el.innerHTML = "";

    let cancelled = false;

    (async () => {
      const VF = await import("vexflow");
      if (cancelled) return;

      const { Renderer, Stave, StaveNote, Formatter, Accidental } = VF.default ?? VF;

      const renderer = new Renderer(el, Renderer.Backends.SVG);
      renderer.resize(width, height);
      const context = renderer.getContext();

      const stave = new Stave(10, 20, width - 20);
      stave.addClef(clef);
      if (keySignature && keySignature !== "C" && keySignature !== "Am") {
        stave.addKeySignature(keySignature);
      }
      stave.setContext(context).draw();

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
    })();

    return () => {
      cancelled = true;
    };
  }, [note, clef, keySignature, width, height]);

  return (
    <div
      ref={containerRef}
      className="flex items-center justify-center bg-white rounded-xl border border-border"
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
