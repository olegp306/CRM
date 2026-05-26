import { describe, expect, it } from "vitest";
import { getAssistantExecutionButtons, getAssistantExecutionLabel } from "./assistant-execution-label";

describe("assistant execution label", () => {
  it("labels existing lead matches and links back to CRM", () => {
    const execution = {
      status: "executed",
      actionType: "existing_lead_match",
      leadId: "L-2026-001",
      recordId: "lead-record-existing",
      matchedFields: ["clientName", "projectAddress"]
    } as const;

    expect(getAssistantExecutionLabel(execution)).toBe("Existing lead L-2026-001");
    expect(getAssistantExecutionButtons(execution)).toEqual([{ label: "CRM", url: "/leads?leadId=L-2026-001" }]);
  });

  it("labels partial lead matches as clarification requests", () => {
    const execution = {
      status: "executed",
      actionType: "needs_clarification",
      leadId: "L-2026-001",
      recordId: "lead-record-existing",
      matchedFields: ["projectAddress"]
    } as const;

    expect(getAssistantExecutionLabel(execution)).toBe("Needs clarification for L-2026-001");
    expect(getAssistantExecutionButtons(execution)).toEqual([{ label: "CRM", url: "/leads?leadId=L-2026-001" }]);
  });

  it("labels exact duplicate lead matches", () => {
    const execution = {
      status: "executed",
      actionType: "duplicate_lead",
      leadId: "L-2026-001",
      recordId: "lead-record-existing",
      reason: "same_text"
    } as const;

    expect(getAssistantExecutionLabel(execution)).toBe("Duplicate lead L-2026-001");
    expect(getAssistantExecutionButtons(execution)).toEqual([{ label: "CRM", url: "/leads?leadId=L-2026-001" }]);
  });
});
