import { describe, expect, it } from "vitest";
import { createActionPreview } from "./action-preview";
import type { ExecuteAssistantActionResult } from "./action-execution";
import type { AssistantActionWriteDraft } from "./persistence";
import { createWebLeadEntityExtractionRequest } from "./web-lead-entity-extraction";

const baseAction: AssistantActionWriteDraft = {
  workspaceId: "workspace-demo",
  threadId: "thread-1",
  messageId: "message-1",
  actionType: "create_lead",
  requestedByUserId: "user-1",
  status: "confirmed",
  preview: createActionPreview({
    actionType: "create_lead",
    summary: "Create lead",
    changes: [{ field: "lead.sourceText", from: null, to: "Client wants a renovation and a follow-up tomorrow." }]
  })
};

describe("createWebLeadEntityExtractionRequest", () => {
  it("creates an extraction request for a confirmed web lead creation", () => {
    const execution: ExecuteAssistantActionResult = {
      status: "executed",
      leadId: "L-2026-001",
      recordId: "lead-record-1"
    };

    expect(createWebLeadEntityExtractionRequest({ action: baseAction, execution })).toEqual({
      workspaceId: "workspace-demo",
      leadRecordId: "lead-record-1",
      leadId: "L-2026-001",
      messageId: "message-1",
      threadId: "thread-1",
      text: "Client wants a renovation and a follow-up tomorrow.",
      actorUserId: "user-1"
    });
  });

  it("creates an extraction request for a confirmed web lead update", () => {
    const action: AssistantActionWriteDraft = {
      ...baseAction,
      actionType: "update_lead",
      preview: createActionPreview({
        actionType: "update_lead",
        summary: "Update lead",
        changes: [
          { field: "lead.selectedRecordIds", from: [], to: ["L-2026-001"] },
          { field: "lead.sourceText", from: null, to: "Remember that the client likes jazz." }
        ]
      })
    };
    const execution: ExecuteAssistantActionResult = {
      status: "executed",
      actionType: "update_lead",
      leadId: "L-2026-001",
      recordId: "lead-record-1",
      fieldsChanged: ["rawInput"]
    };

    expect(createWebLeadEntityExtractionRequest({ action, execution })).toMatchObject({
      leadRecordId: "lead-record-1",
      leadId: "L-2026-001",
      text: "Remember that the client likes jazz."
    });
  });

  it("skips non-lead mutation executions", () => {
    const execution: ExecuteAssistantActionResult = {
      status: "executed",
      actionType: "mark_kp_sent",
      leadId: "L-2026-001",
      recordId: "lead-record-1"
    };

    expect(createWebLeadEntityExtractionRequest({ action: baseAction, execution })).toBeNull();
  });
});
