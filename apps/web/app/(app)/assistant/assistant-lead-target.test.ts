import { describe, expect, it } from "vitest";
import { getAssistantLeadTargetId } from "./assistant-lead-target";

describe("assistant lead target", () => {
  it("uses the selected lead before parsing message text", () => {
    expect(getAssistantLeadTargetId("Напомни завтра позвонить L-2026-999", ["L-2026-004"])).toBe("L-2026-004");
  });

  it("uses an explicit lead id from message text when no lead is selected", () => {
    expect(getAssistantLeadTargetId("Напомни завтра позвонить лиду L-2026-004", [])).toBe("L-2026-004");
  });

  it("returns null when neither selected context nor text contains a lead id", () => {
    expect(getAssistantLeadTargetId("Напомни завтра позвонить клиенту", [])).toBeNull();
  });
});
