"use client";

import { SYMBOL_PATHS } from "@/lib/symbol-paths";

interface VexFlowSymbolProps {
  symbolId: string;
  fallbackText: string;
  size?: number;
  className?: string;
}

/**
 * Renders a musical symbol from pre-extracted Bravura vector paths.
 * No font loading, no VexFlow runtime import, no race conditions.
 * Uses `currentColor` so it inherits text color (works with dark mode).
 */
export function VexFlowSymbol({
  symbolId,
  fallbackText,
  size = 48,
  className,
}: VexFlowSymbolProps) {
  const glyph = SYMBOL_PATHS[symbolId];
  if (!glyph) {
    return <span className={className}>{fallbackText}</span>;
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={glyph.viewBox}
      width={size}
      height={size}
      className={className}
      style={{ display: "inline-block" }}
      aria-label={fallbackText}
      role="img"
    >
      <path d={glyph.d} fill="currentColor" />
    </svg>
  );
}

/**
 * Renders a symbol with its parenthetical description on a separate line.
 * e.g. "• (dot above note)" → symbol on top, "(dot above note)" below.
 */
export function SymbolDisplay({
  symbolId,
  symbolText,
  size = 48,
  className,
}: {
  symbolId: string;
  symbolText: string;
  size?: number;
  className?: string;
}) {
  const parenMatch = symbolText.match(/^(.+?)\s*(\(.+\))$/);
  const mainText = parenMatch ? parenMatch[1].trim() : symbolText;
  const description = parenMatch ? parenMatch[2] : null;

  return (
    <div className={`flex flex-col items-center ${className ?? ""}`}>
      <VexFlowSymbol
        symbolId={symbolId}
        fallbackText={mainText}
        size={size}
        className="text-4xl font-bold"
      />
      {description && (
        <div className="text-base text-muted mt-1">{description}</div>
      )}
    </div>
  );
}
