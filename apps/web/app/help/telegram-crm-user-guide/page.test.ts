import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(join(__dirname, "page.tsx"), "utf8");
const guideSource = readFileSync(join(__dirname, "..", "..", "..", "..", "..", "docs", "TELEGRAM_CRM_USER_GUIDE_RU.md"), "utf8");

describe("Telegram CRM user guide page", () => {
  it("renders the guide from Markdown without raw details tags", () => {
    expect(pageSource).toContain("TELEGRAM_CRM_USER_GUIDE_RU.md");
    expect(pageSource).toContain("border-emerald-200");
    expect(pageSource).toContain("Хороший пример");
    expect(guideSource).toContain("> [!TIP]");
    expect(guideSource).not.toContain("<details");
    expect(guideSource).not.toContain("<summary");
  });
});
