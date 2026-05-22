import { describe, expect, it } from "vitest";
import { createDocxPackageBytes } from "./docx-package";

describe("DOCX package generation", () => {
  it("creates a Word-compatible OOXML zip package from plain paragraphs", () => {
    const bytes = createDocxPackageBytes({
      title: "KP document D-20260521-message-4",
      paragraphs: ["Lead: L-2026-001", "Scope: design concept and BGF estimate"]
    });
    const text = new TextDecoder().decode(bytes);

    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    expect(text).toContain("[Content_Types].xml");
    expect(text).toContain("word/document.xml");
    expect(text).toContain("KP document D-20260521-message-4");
    expect(text).toContain("design concept and BGF estimate");
  });

  it("escapes XML characters in document content", () => {
    const bytes = createDocxPackageBytes({
      title: "A&B",
      paragraphs: ["Client <private> needs 120 m2 & ROI input"]
    });
    const text = new TextDecoder().decode(bytes);

    expect(text).toContain("A&amp;B");
    expect(text).toContain("Client &lt;private&gt; needs 120 m2 &amp; ROI input");
  });
});
