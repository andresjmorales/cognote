"use client";

/**
 * Inline SVG replacements for Unicode Musical Symbols (U+1D100–U+1D1FF)
 * that don't render on iOS/Safari. Only symbols known to break are included;
 * well-supported characters (♩, ♪, ♯, ♭, ♮, etc.) render as plain text.
 */

import React from "react";

interface MusicalSymbolIconProps {
  symbolId: string;
  /** px height — width scales proportionally */
  size?: number;
  className?: string;
}

/* ---------- SVG builders keyed by symbol id ---------- */

function wholeNote(h: number) {
  const w = h * 1.6;
  return (
    <svg width={w} height={h} viewBox="0 0 48 30" aria-label="Whole Note">
      <ellipse cx="24" cy="15" rx="18" ry="11" fill="none" stroke="currentColor" strokeWidth="3" transform="rotate(-15 24 15)" />
      <ellipse cx="24" cy="15" rx="8" ry="10" fill="currentColor" transform="rotate(45 24 15)" />
    </svg>
  );
}

function halfNote(h: number) {
  const w = h * 0.7;
  return (
    <svg width={w} height={h} viewBox="0 0 28 48" aria-label="Half Note">
      <ellipse cx="12" cy="36" rx="10" ry="7" fill="none" stroke="currentColor" strokeWidth="2.5" transform="rotate(-20 12 36)" />
      <line x1="21" y1="34" x2="21" y2="4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function dottedHalfNote(h: number) {
  const w = h * 0.85;
  return (
    <svg width={w} height={h} viewBox="0 0 34 48" aria-label="Dotted Half Note">
      <ellipse cx="12" cy="36" rx="10" ry="7" fill="none" stroke="currentColor" strokeWidth="2.5" transform="rotate(-20 12 36)" />
      <line x1="21" y1="34" x2="21" y2="4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="28" cy="36" r="2.5" fill="currentColor" />
    </svg>
  );
}

function quarterRest(h: number) {
  const w = h * 0.45;
  return (
    <svg width={w} height={h} viewBox="0 0 18 44" aria-label="Quarter Rest">
      <path
        d="M10 4 L4 14 L12 22 L6 30 Q2 36 6 40 Q10 44 12 40 Q14 36 8 32 L14 24 L6 16 L12 8 Z"
        fill="currentColor"
      />
    </svg>
  );
}

function fermata(h: number) {
  const w = h * 1.3;
  return (
    <svg width={w} height={h} viewBox="0 0 40 30" aria-label="Fermata">
      <path d="M4 26 Q4 6 20 4 Q36 6 36 26" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <circle cx="20" cy="20" r="3" fill="currentColor" />
    </svg>
  );
}

function trebleClef(h: number) {
  const w = h * 0.55;
  return (
    <svg width={w} height={h} viewBox="0 0 28 56" aria-label="Treble Clef">
      <path
        d="M16 52 Q8 48 6 40 Q4 32 10 26 Q14 22 14 18 Q14 12 12 8 Q10 6 12 4 Q14 2 16 6 Q20 14 18 24 Q16 30 12 34 Q6 40 10 46 Q14 50 18 46 Q22 42 18 38 Q14 36 12 38"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function bassClef(h: number) {
  const w = h * 1.1;
  return (
    <svg width={w} height={h} viewBox="0 0 40 36" aria-label="Bass Clef">
      <circle cx="8" cy="10" r="4" fill="currentColor" />
      <path d="M12 10 Q28 10 28 22 Q28 32 14 34" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <circle cx="34" cy="14" r="2.5" fill="currentColor" />
      <circle cx="34" cy="22" r="2.5" fill="currentColor" />
    </svg>
  );
}

function repeatSigns(h: number) {
  const w = h * 1.4;
  return (
    <svg width={w} height={h} viewBox="0 0 52 36" aria-label="Repeat Signs">
      {/* Left repeat */}
      <rect x="2" y="2" width="3" height="32" rx="1" fill="currentColor" />
      <rect x="8" y="2" width="1.5" height="32" rx="0.5" fill="currentColor" />
      <circle cx="14" cy="13" r="2.5" fill="currentColor" />
      <circle cx="14" cy="23" r="2.5" fill="currentColor" />
      {/* Right repeat */}
      <circle cx="38" cy="13" r="2.5" fill="currentColor" />
      <circle cx="38" cy="23" r="2.5" fill="currentColor" />
      <rect x="42.5" y="2" width="1.5" height="32" rx="0.5" fill="currentColor" />
      <rect x="47" y="2" width="3" height="32" rx="1" fill="currentColor" />
    </svg>
  );
}

const SVG_BUILDERS: Record<string, (h: number) => React.ReactElement> = {
  "whole-note": wholeNote,
  "half-note": halfNote,
  "dotted-half": dottedHalfNote,
  "quarter-rest": quarterRest,
  "fermata": fermata,
  "treble-clef": trebleClef,
  "bass-clef": bassClef,
  "repeat-sign": repeatSigns,
};

/**
 * Returns true if this symbol ID has an SVG replacement
 * (i.e. the Unicode character is known to break on iOS).
 */
export function hasSymbolSvg(symbolId: string): boolean {
  return symbolId in SVG_BUILDERS;
}

/**
 * Renders either an inline SVG (for broken Unicode symbols) or the raw text.
 * Use this everywhere a musical symbol character is displayed.
 */
export function MusicalSymbolIcon({
  symbolId,
  size = 40,
  className,
}: MusicalSymbolIconProps) {
  const builder = SVG_BUILDERS[symbolId];
  if (!builder) return null;

  return (
    <span className={`inline-flex items-center justify-center ${className ?? ""}`}>
      {builder(size)}
    </span>
  );
}

/**
 * Helper: render symbol display with SVG fallback.
 * If the symbol has an SVG, renders it; otherwise renders the text.
 */
export function SymbolDisplay({
  symbolId,
  symbolText,
  size = 40,
  className,
}: {
  symbolId: string;
  symbolText: string;
  size?: number;
  className?: string;
}) {
  if (hasSymbolSvg(symbolId)) {
    return <MusicalSymbolIcon symbolId={symbolId} size={size} className={className} />;
  }
  return <span className={className}>{symbolText}</span>;
}
