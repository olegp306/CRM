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
    expect(tableSource).toContain("sticky top-0 z-30");
    expect(tableSource).toContain("Full screen lead close");
    expect(tableSource).toContain("bg-black");
    expect(tableSource).toContain("text-white");
    expect(tableSource).toContain("Close");
    expect(tableSource).toContain("Send KP");
    expect(tableSource).toContain("Refresh summary");
    expect(pageSource).toContain("regenerateLeadSummaryAction");
  });

  it("opens every lead editor as a fullscreen card with a persistent close action", () => {
    expect(tableSource).toContain('variant="fullscreen"');
    expect(tableSource).not.toContain('variant="modal"');
    expect(tableSource).not.toContain('variant?: "panel" | "modal" | "fullscreen"');
    expect(tableSource).toContain("sticky top-0 z-30");
    expect(tableSource).toContain("Full screen lead close");
  });

  it("offers a CSV export from the lead table", () => {
    expect(tableSource).toContain("/exports/leads");
    expect(tableSource).toContain("Export to Excel (CSV)");
  });

  it("shows lead summary info before history and keeps source blocks mobile-safe", () => {
    expect(tableSource.indexOf("<LeadActionCalendarPanel")).toBeGreaterThan(-1);
    expect(tableSource.indexOf("<LeadActionCalendarPanel")).toBeLessThan(tableSource.indexOf("<LeadSummaryInfoPanel"));
    expect(tableSource).toContain("Action calendar");
    expect(tableSource).toContain("Next scheduled action");
    expect(tableSource.indexOf("<LeadSummaryInfoPanel")).toBeGreaterThan(-1);
    expect(tableSource.indexOf("<LeadSummaryInfoPanel")).toBeLessThan(tableSource.indexOf("<LeadHistoryPanel"));
    expect(tableSource).toContain("Lead summary info");
    expect(tableSource).toContain("Translate summary to Russian");
    expect(tableSource).toContain("Translate summary to German");
    expect(tableSource).toContain("Show full");
    expect(tableSource).toContain("View file");
    expect(tableSource).toContain("function ExpandableLeadText");
    expect(tableSource).toContain("summaryItem.fullText ?? summaryItem.description");
    expect(tableSource).not.toContain(">Download<");
    expect(tableSource).toContain("break-all");
    expect(tableSource).toContain("min-w-0 overflow-hidden");
    expect(tableSource).toContain("min-h-[44px]");
    expect(tableSource).toContain("px-3 py-3");
    expect(tableSource).toContain("function LeadCardAccordion");
    expect(tableSource).toContain("aria-expanded={isOpen}");
    expect(tableSource).toContain('type="button"');
  });

  it("renders collapsed lead card sections as visible mobile rows", () => {
    expect(tableSource).toContain('className="fixed inset-0 z-50 w-screen overflow-hidden bg-white"');
    expect(tableSource).toContain('className="box-border h-screen max-h-screen w-full max-w-full overflow-y-auto overflow-x-hidden p-4 pb-32 scroll-pb-32"');
    expect(tableSource).toContain('className="sticky top-0 z-30 -mx-4 -mt-4 flex w-[calc(100%+2rem)] justify-end border-b border-border bg-white/95 px-4 py-3 backdrop-blur"');
    expect(tableSource).not.toContain('className="grid h-screen max-h-screen gap-4 overflow-auto p-4 pb-32 scroll-pb-32"');
    expect(tableSource).toContain('className="mt-4 min-w-0 overflow-hidden rounded-lg border border-border bg-muted/30"');
    expect(tableSource).toContain('className="flex min-h-[44px] w-full items-center justify-between gap-3 px-3 py-3 text-sm font-semibold text-foreground"');
    expect(tableSource).toContain('className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"');
    expect(tableSource).not.toContain("className={leadAccordionClassName}");
    expect(tableSource).not.toContain("className={leadAccordionSummaryClassName}");
  });

  it("shows all lead card summary field values without ellipsis truncation", () => {
    const summaryStart = tableSource.indexOf("function LeadKpSummary");
    const summaryEnd = tableSource.indexOf("function TemperatureBadge");
    const summarySource = tableSource.slice(summaryStart, summaryEnd);

    expect(summarySource).toContain("break-words");
    expect(summarySource).toContain("whitespace-normal");
    expect(summarySource).not.toContain("truncate");
    expect(summarySource).not.toContain("field.wrap");
  });
});
