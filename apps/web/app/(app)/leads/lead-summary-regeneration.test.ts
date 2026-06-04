import { describe, expect, it } from "vitest";
import { replaceLeadSummaryInRawInput } from "./lead-summary-regeneration";

describe("lead summary regeneration", () => {
  it("replaces an existing lead summary without touching the rest of raw input", () => {
    expect(replaceLeadSummaryInRawInput("Telegram sources: telegram:1:2\nLead summary: Old text\nPhone: +49", "New concise text")).toBe(
      "Telegram sources: telegram:1:2\nLead summary: New concise text\nPhone: +49"
    );
  });

  it("replaces a generic summary line when lead summary is missing", () => {
    expect(replaceLeadSummaryInRawInput("Summary: Old generic text\nEmail: client@example.com", "New lead summary")).toBe(
      "Lead summary: New lead summary\nEmail: client@example.com"
    );
  });

  it("appends a lead summary when no summary exists", () => {
    expect(replaceLeadSummaryInRawInput("Telegram sources: telegram:1:2", "Parsed lead summary")).toBe(
      "Telegram sources: telegram:1:2\nLead summary: Parsed lead summary"
    );
  });
});
