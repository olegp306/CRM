import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(join(__dirname, "page.tsx"), "utf8");
const copySource = readFileSync(join(__dirname, "copy-code-block.tsx"), "utf8");
const guideSource = readFileSync(
  join(__dirname, "..", "..", "..", "..", "..", "docs", "TELEGRAM_CRM_USER_GUIDE_RU.md"),
  "utf8"
);

describe("Telegram CRM user guide page", () => {
  it("renders the guide from Markdown without raw details tags", () => {
    expect(pageSource).toContain("TELEGRAM_CRM_USER_GUIDE_RU.md");
    expect(pageSource).toContain("border-emerald-200");
    expect(guideSource).toContain("> [!TIP]");
    expect(guideSource).not.toContain("<details");
    expect(guideSource).not.toContain("<summary");
  });

  it("renders numbered steps as ordered lists and makes examples copyable", () => {
    expect(pageSource).toContain("orderedList");
    expect(pageSource).toContain("list-decimal");
    expect(pageSource).toContain("CopyCodeBlock");
    expect(copySource).toContain("navigator.clipboard.writeText");
    expect(copySource).toContain("fallbackCopyText");
    expect(copySource).toContain('document.execCommand("copy")');
    expect(copySource).toContain("Скопировать");
    expect(copySource).toContain("Выделите вручную");
    expect(guideSource).toMatch(/^1\.\s+/m);
  });

  it("adds quick links to the main command sections", () => {
    expect(pageSource).toContain("quickGuideLinks");
    expect(pageSource).toContain("#guide-create");
    expect(pageSource).toContain("#guide-search");
    expect(pageSource).toContain("#guide-update");
    expect(pageSource).toContain("#guide-reminder");
    expect(pageSource).toContain("getGuideHeadingId");
    expect(pageSource).toContain("scroll-mt-4");
  });
});
