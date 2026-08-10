import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatMoney } from "@/lib/billing";

export interface InvoicePdfItem {
  description: string;
  quantity: number;
  unitCents: number;
  amountCents: number;
}

export interface InvoicePdfInput {
  studioName: string;
  familyName: string;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string;
  currency: string;
  items: InvoicePdfItem[];
  subtotalCents: number;
  paymentInstructions: string;
  notes?: string;
}

/**
 * Helvetica (StandardFonts) only supports WinAnsi. Map common punctuation
 * and drop the rest (emoji, etc.) so student names like "Andrés❤️" don't
 * crash invoice send.
 */
export function toPdfSafeText(text: string): string {
  const replacements: Record<string, string> = {
    "\u2018": "'",
    "\u2019": "'",
    "\u201C": '"',
    "\u201D": '"',
    "\u2013": "-",
    "\u2014": "-",
    "\u2026": "...",
    "\u00A0": " ",
    "\u2022": "*",
  };
  let out = "";
  for (const char of text) {
    if (replacements[char] !== undefined) {
      out += replacements[char];
      continue;
    }
    if (char === "\n" || char === "\r") {
      out += char;
      continue;
    }
    if (char === "\t") {
      out += " ";
      continue;
    }
    const code = char.codePointAt(0)!;
    // Keep printable ASCII + Latin-1 (covers é, ñ, etc. via WinAnsi).
    if (code >= 0x20 && code <= 0xff) {
      out += char;
    }
  }
  return out.replace(/ {2,}/g, " ");
}

function formatPeriod(start: string, end: string): string {
  const fmt = (d: string) => {
    const [y, m, day] = d.split("-").map(Number);
    return new Date(y, m - 1, day).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };
  return toPdfSafeText(`${fmt(start)} – ${fmt(end)}`);
}

/** Generate a simple invoice PDF buffer. */
export async function buildInvoicePdf(
  input: InvoicePdfInput
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]); // US Letter
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const { height } = page.getSize();
  const margin = 50;
  let y = height - margin;

  const draw = (
    text: string,
    opts: {
      size?: number;
      font?: typeof font;
      x?: number;
      color?: ReturnType<typeof rgb>;
    } = {}
  ) => {
    page.drawText(toPdfSafeText(text), {
      x: opts.x ?? margin,
      y,
      size: opts.size ?? 11,
      font: opts.font ?? font,
      color: opts.color ?? rgb(0.1, 0.1, 0.1),
    });
  };

  const studio = input.studioName.trim() || "Studio";
  draw(studio, { size: 18, font: bold });
  y -= 22;
  draw("Invoice", { size: 14, font: bold, color: rgb(0.3, 0.3, 0.3) });
  y -= 28;

  draw(`Family: ${input.familyName}`, { font: bold });
  y -= 16;
  draw(`Period: ${formatPeriod(input.periodStart, input.periodEnd)}`);
  y -= 28;

  // Column headers
  draw("Description", { font: bold, size: 10 });
  draw("Amount", { font: bold, size: 10, x: 480 });
  y -= 6;
  page.drawLine({
    start: { x: margin, y },
    end: { x: 612 - margin, y },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  });
  y -= 16;

  for (const item of input.items) {
    if (y < 120) {
      // Keep it simple: one page is enough for typical studio invoices
      break;
    }
    const rawDesc = toPdfSafeText(item.description);
    const desc =
      rawDesc.length > 70 ? `${rawDesc.slice(0, 67)}...` : rawDesc;
    draw(desc, { size: 10 });
    draw(formatMoney(item.amountCents, input.currency), {
      size: 10,
      x: 480,
    });
    y -= 14;
  }

  y -= 8;
  page.drawLine({
    start: { x: margin, y },
    end: { x: 612 - margin, y },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  });
  y -= 20;
  draw("Total", { font: bold, size: 12 });
  draw(formatMoney(input.subtotalCents, input.currency), {
    font: bold,
    size: 12,
    x: 480,
  });

  if (input.paymentInstructions.trim()) {
    y -= 36;
    draw("Payment instructions", { font: bold, size: 11 });
    y -= 14;
    for (const line of wrapText(input.paymentInstructions, 90)) {
      draw(line, { size: 10 });
      y -= 13;
      if (y < 60) break;
    }
  }

  if (input.notes?.trim()) {
    y -= 20;
    draw("Notes", { font: bold, size: 11 });
    y -= 14;
    for (const line of wrapText(input.notes, 90)) {
      draw(line, { size: 10 });
      y -= 13;
      if (y < 60) break;
    }
  }

  return doc.save();
}

function wrapText(text: string, maxChars: number): string[] {
  const words = toPdfSafeText(text).replace(/\r\n/g, "\n").split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}
