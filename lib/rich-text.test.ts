import { describe, expect, it } from "vitest";
import { markdownToTiptapHtml, stripHtmlToText } from "@/lib/rich-text";

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

describe("stripHtmlToText", () => {
  it("strips tags and decodes a single entity level", () => {
    expect(stripHtmlToText("<p>Hello&nbsp;<strong>world</strong></p>")).toBe(
      "Hello world"
    );
    expect(stripHtmlToText("a &amp; b")).toBe("a & b");
    // Double-encoded entities stay single-encoded after one decode pass.
    expect(stripHtmlToText("&amp;lt;script&amp;gt;")).toBe("&lt;script&gt;");
  });

  it("neutralizes nested broken tags", () => {
    const out = stripHtmlToText("<scr<script>ipt>x</scr</script>ipt>");
    expect(out).not.toMatch(/</);
    expect(out).toContain("x");
  });
});
