/**
 * One-time script: extracts Bravura SMuFL glyphs from VexFlow's embedded font
 * and saves them as standalone SVG files in public/symbols/.
 *
 * Usage:  node scripts/extract-bravura-glyphs.js
 *
 * Requires: opentype.js, wawoff2 (dev deps)
 */

const opentype = require("opentype.js");
const fs = require("fs");
const path = require("path");

const OUT_DIR = path.join(__dirname, "..", "public", "symbols");

// SMuFL Unicode code points for each symbol we need.
// Using metronome-mark variants for notes (designed for standalone display).
const GLYPHS = {
  // Notation
  "treble-clef":   { codepoints: [0xE050] },   // gClef
  "bass-clef":     { codepoints: [0xE062] },   // fClef
  "fermata":       { codepoints: [0xE4C0] },   // fermataAbove

  // Notes (metronome-mark variants — designed for standalone display)
  "whole-note":    { codepoints: [0xECA2] },   // metNoteWhole
  "half-note":     { codepoints: [0xECA3] },   // metNoteHalfUp
  "quarter-note":  { codepoints: [0xECA5] },   // metNoteQuarterUp
  "eighth-note":   { codepoints: [0xECA7] },   // metNote8thUp
  "dotted-half":   { codepoints: [0xECA3, 0xE1E7] }, // metNoteHalfUp + augmentationDot

  // Rests
  "whole-rest":    { codepoints: [0xE4E3] },   // restWhole
  "half-rest":     { codepoints: [0xE4E4] },   // restHalf
  "quarter-rest":  { codepoints: [0xE4E5] },   // restQuarter

  // Accidentals
  "sharp":         { codepoints: [0xE262] },   // accidentalSharp
  "flat":          { codepoints: [0xE260] },   // accidentalFlat
  "natural":       { codepoints: [0xE261] },   // accidentalNatural

  // Repeats & Navigation
  "repeat-sign":   { codepoints: [0xE041] },   // repeatRight
  "coda":          { codepoints: [0xE048] },   // coda

  // Dynamics
  "pp":            { codepoints: [0xE52B] },   // dynamicPP
  "p":             { codepoints: [0xE520] },   // dynamicPiano
  "mp":            { codepoints: [0xE52C] },   // dynamicMP
  "mf":            { codepoints: [0xE52D] },   // dynamicMF
  "f":             { codepoints: [0xE522] },   // dynamicForte
  "ff":            { codepoints: [0xE52F] },   // dynamicFF
  "crescendo":     { codepoints: [0xE53E] },   // dynamicCrescendoHairpin
  "decrescendo":   { codepoints: [0xE53F] },   // dynamicDiminuendoHairpin

  // Articulation
  "staccato":      { codepoints: [0xE4A2] },   // articStaccatoAbove
  "accent":        { codepoints: [0xE4A0] },   // articAccentAbove
  "tenuto":        { codepoints: [0xE4A4] },   // articTenutoAbove
};

const FONT_SIZE = 200; // units-per-em based rendering size
const PADDING = 10;    // padding around the glyph in SVG units

async function main() {
  // 1. Extract WOFF2 from VexFlow and decompress to OTF on disk
  const tmpOtf = path.join(__dirname, "..", "bravura.otf");

  if (!fs.existsSync(tmpOtf)) {
    const bravuraJs = fs.readFileSync(
      path.join(__dirname, "..", "node_modules", "vexflow", "build", "esm", "src", "fonts", "bravura.js"),
      "utf8"
    );
    const b64Match = bravuraJs.match(
      /data:font\/woff2;charset=utf-8;base64,([A-Za-z0-9+/=]+)/
    );
    if (!b64Match) throw new Error("Could not find Bravura WOFF2 in VexFlow");

    const woff2Buf = Buffer.from(b64Match[1], "base64");
    const wawoff2 = require("wawoff2");
    const sfntBuf = await wawoff2.decompress(woff2Buf);
    fs.writeFileSync(tmpOtf, Buffer.from(sfntBuf));
    console.log("Decompressed WOFF2 → bravura.otf");
  }

  // 2. Parse with opentype.js (loadSync reads from disk — reliable)
  const font = opentype.loadSync(tmpOtf);
  console.log(`Loaded Bravura — ${font.numGlyphs} glyphs`);

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  // 3. For each symbol, extract glyph path(s) and write SVG
  for (const [id, config] of Object.entries(GLYPHS)) {
    const { codepoints } = config;
    let combinedPath = "";
    let xOffset = 0;

    // Compute overall bounding box across all glyphs in this symbol
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    const glyphPaths = [];

    for (const cp of codepoints) {
      const glyph = font.charToGlyph(String.fromCodePoint(cp));
      if (!glyph || glyph.index === 0) {
        console.warn(`  ⚠ No glyph found for ${id} codepoint U+${cp.toString(16).toUpperCase()}`);
        continue;
      }

      const glyphPath = glyph.getPath(xOffset, 0, FONT_SIZE);
      const pathData = glyphPath.toPathData(2);
      const bb = glyphPath.getBoundingBox();

      glyphPaths.push(pathData);

      minX = Math.min(minX, bb.x1);
      minY = Math.min(minY, bb.y1);
      maxX = Math.max(maxX, bb.x2);
      maxY = Math.max(maxY, bb.y2);

      // Advance x for the next glyph (if composite like dotted-half)
      const advWidth = glyph.advanceWidth
        ? (glyph.advanceWidth / font.unitsPerEm) * FONT_SIZE
        : bb.x2 - bb.x1 + 10;
      xOffset += advWidth;
    }

    if (glyphPaths.length === 0) {
      console.warn(`  ✗ Skipping ${id} — no glyph data`);
      continue;
    }

    combinedPath = glyphPaths.join(" ");

    const width = maxX - minX + PADDING * 2;
    const height = maxY - minY + PADDING * 2;
    const vbX = minX - PADDING;
    const vbY = minY - PADDING;

    const svg = [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${r(vbX)} ${r(vbY)} ${r(width)} ${r(height)}">`,
      `  <path d="${combinedPath}" fill="currentColor"/>`,
      `</svg>`,
    ].join("\n");

    const outFile = path.join(OUT_DIR, `${id}.svg`);
    fs.writeFileSync(outFile, svg, "utf8");
    console.log(`  ✓ ${id}.svg  (${r(width)}×${r(height)})`);
  }

  // 4. Generate TypeScript module with inline path data
  const tsEntries = [];
  for (const [id, config] of Object.entries(GLYPHS)) {
    const svgFile = path.join(OUT_DIR, `${id}.svg`);
    if (!fs.existsSync(svgFile)) continue;
    const svgContent = fs.readFileSync(svgFile, "utf8");
    const vbMatch = svgContent.match(/viewBox="([^"]+)"/);
    const pathMatch = svgContent.match(/d="([^"]+)"/);
    if (!vbMatch || !pathMatch) continue;
    tsEntries.push(`  "${id}": { viewBox: "${vbMatch[1]}", d: "${pathMatch[1]}" }`);
  }

  const tsModule = [
    `/** Auto-generated by scripts/extract-bravura-glyphs.js — do not edit */`,
    `export const SYMBOL_PATHS: Record<string, { viewBox: string; d: string }> = {`,
    tsEntries.join(",\n"),
    `};`,
    ``,
  ].join("\n");

  const tsFile = path.join(__dirname, "..", "lib", "symbol-paths.ts");
  fs.writeFileSync(tsFile, tsModule, "utf8");
  console.log(`\nGenerated ${tsFile}`);
  console.log(`Done — ${Object.keys(GLYPHS).length} symbols → ${OUT_DIR} + lib/symbol-paths.ts`);
}

function r(n) {
  return Math.round(n * 100) / 100;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
