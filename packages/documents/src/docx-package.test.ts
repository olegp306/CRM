import { describe, expect, it } from "vitest";
import { createDocxPackageBytes, renderDocxTemplatePackageBytes } from "./docx-package";

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

  it("renders placeholders inside an uploaded DOCX package", () => {
    const templateBytes = createDocxPackageBytes({
      title: "KP for {{ client_name }}",
      paragraphs: ["Address: {{ project_address }}", "BGF: {{ bgf }}"]
    });

    const result = renderDocxTemplatePackageBytes({
      templateBytes,
      values: {
        client_name: "Katya & Partner",
        project_address: "Chiemseeufer 7",
        bgf: 180
      }
    });
    const text = new TextDecoder().decode(result.bytes);

    expect(result.usedPlaceholders).toEqual(["bgf", "client_name", "project_address"]);
    expect(result.missingPlaceholders).toEqual([]);
    expect(text).toContain("KP for Katya &amp; Partner");
    expect(text).toContain("Address: Chiemseeufer 7");
    expect(text).toContain("BGF: 180");
    expect(text).not.toContain("{{ client_name }}");
  });

  it("prepends draft paragraphs and reports missing placeholders", () => {
    const templateBytes = createDocxPackageBytes({
      title: "KP for {{ client_name }}",
      paragraphs: ["Address: {{ project_address }}"]
    });

    const result = renderDocxTemplatePackageBytes({
      templateBytes,
      values: {
        client_name: "Katya",
        project_address: null
      },
      prependParagraphs: ["DRAFT: missing project address", "Processed lead brief"]
    });
    const text = new TextDecoder().decode(result.bytes);

    expect(result.missingPlaceholders).toEqual(["project_address"]);
    expect(text.indexOf("DRAFT: missing project address")).toBeLessThan(text.indexOf("KP for Katya"));
    expect(text).toContain("Processed lead brief");
  });
});
