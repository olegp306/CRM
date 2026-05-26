import { describe, expect, it } from "vitest";
import { getAssistantActionPreviewRows } from "./assistant-action-preview";

describe("getAssistantActionPreviewRows", () => {
  it("formats source material and selected lead rows for assistant action previews", () => {
    expect(
      getAssistantActionPreviewRows({
        actionType: "mark_kp_sent",
        summary: "Mark KP as sent from assistant request",
        requiresConfirmation: true,
        warnings: [],
        changes: [
          { field: "lead.selectedRecordIds", from: null, to: ["L-2026-001"] },
          { field: "lead.sourceText", from: null, to: "КП отправлено" }
        ]
      })
    ).toEqual([
      { label: "Lead", value: "L-2026-001" },
      { label: "Source", value: "КП отправлено" }
    ]);
  });

  it("keeps attachment summaries visible in create lead previews", () => {
    expect(
      getAssistantActionPreviewRows({
        actionType: "create_lead",
        summary: "Create lead from assistant source material",
        requiresConfirmation: true,
        warnings: [],
        changes: [
          {
            field: "lead.sourceText",
            from: null,
            to: "Please review this source material.\nWeb attachment 1: PDF (brief.pdf)"
          }
        ]
      })
    ).toEqual([
      {
        label: "Source",
        value: "Please review this source material.\nWeb attachment 1: PDF (brief.pdf)"
      }
    ]);
  });
});
