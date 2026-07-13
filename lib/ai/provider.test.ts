import { describe, expect, it } from "vitest";
import { ensureProgressNoteTitle } from "@/lib/ai/provider";

describe("ensureProgressNoteTitle", () => {
  it("prepends a dated title when missing", () => {
    expect(ensureProgressNoteTitle("Emma is doing well.", "July 13, 2026")).toBe(
      "# Progress Note — July 13, 2026\n\nEmma is doing well."
    );
  });

  it("rewrites an existing Progress Note heading to the dated form", () => {
    const md = "# Progress Note: Emma\n\n### Overview\n\nHello";
    expect(ensureProgressNoteTitle(md, "July 13, 2026")).toBe(
      "# Progress Note — July 13, 2026\n\n### Overview\n\nHello"
    );
  });
});
