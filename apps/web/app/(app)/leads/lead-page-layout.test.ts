import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(join(__dirname, "page.tsx"), "utf8");
const tableSource = readFileSync(join(__dirname, "leads-table.tsx"), "utf8");

describe("leads page layout", () => {
  it("keeps the leads route focused on the editable lead table", () => {
    expect(pageSource).toContain("<LeadsTable");
    expect(pageSource).not.toContain("L01");
    expect(pageSource).not.toContain("Open intake preview");
    expect(pageSource).not.toContain("Create lead");
    expect(pageSource).not.toContain("Telegram intake");
    expect(pageSource).not.toContain("Create from Telegram");
  });

  it("keeps the Telegram lead card focused on download and close actions", () => {
    expect(tableSource).not.toContain("Open KP record");
    expect(tableSource).toContain("absolute right-3 top-3");
    expect(tableSource).toContain("pr-28");
    expect(tableSource).toContain("bg-black");
    expect(tableSource).toContain("text-white");
    expect(tableSource).toContain("Close");
    expect(tableSource).toContain("Send KP");
  });

  it("offers a CSV export from the lead table", () => {
    expect(tableSource).toContain("/exports/leads");
    expect(tableSource).toContain("Export to Excel (CSV)");
  });

  it("shows lead summary info before history and keeps source blocks mobile-safe", () => {
    expect(tableSource.indexOf("<LeadSummaryInfoPanel")).toBeGreaterThan(-1);
    expect(tableSource.indexOf("<LeadSummaryInfoPanel")).toBeLessThan(tableSource.indexOf("<LeadHistoryPanel"));
    expect(tableSource).toContain("Lead summary info");
    expect(tableSource).toContain("break-all");
    expect(tableSource).toContain("min-w-0 overflow-hidden");
    expect(tableSource).toContain("min-h-12");
    expect(tableSource).toContain("px-3 py-3");
    expect(tableSource).toContain("function LeadCardAccordion");
    expect(tableSource).toContain("aria-expanded={isOpen}");
    expect(tableSource).toContain('type="button"');
  });
});
