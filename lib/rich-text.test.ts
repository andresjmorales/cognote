import { describe, expect, it } from "vitest";
import { markdownToTiptapHtml } from "@/lib/rich-text";

describe("markdownToTiptapHtml", () => {
  it("converts paragraphs, bold, and lists for TipTap", () => {
    const html = markdownToTiptapHtml(
      "Hello **world**.\n\n### Focus\n\n- weak: F#\n- strong: rhythm"
    );
    expect(html).toContain("<p>Hello <strong>world</strong>.</p>");
    expect(html).toContain("<h3>Focus</h3>");
    expect(html).toContain("<ul>");
    expect(html).toContain("<li><p>weak: F#</p></li>");
  });
});
