import type { ExecuteAssistantActionResult } from "./action-execution";
import type { AssistantActionWriteDraft } from "./persistence";

export type WebLeadEntityExtractionRequest = {
  workspaceId: string;
  leadRecordId: string;
  leadId: string;
  messageId: string;
  threadId: string;
  text: string;
  actorUserId: string;
};

export function createWebLeadEntityExtractionRequest(input: {
  action: AssistantActionWriteDraft;
  execution: ExecuteAssistantActionResult;
}): WebLeadEntityExtractionRequest | null {
  if (input.execution.status !== "executed") {
    return null;
  }

  if (!isLeadMutationExecution(input.execution)) {
    return null;
  }

  const text = getPreviewString(input.action, "lead.sourceText");
  if (!text) {
    return null;
  }

  return {
    workspaceId: input.action.workspaceId,
    leadRecordId: input.execution.recordId,
    leadId: input.execution.leadId,
    messageId: input.action.messageId,
    threadId: input.action.threadId,
    text,
    actorUserId: input.action.requestedByUserId
  };
}

function isLeadMutationExecution(
  execution: ExecuteAssistantActionResult
): execution is Extract<
  ExecuteAssistantActionResult,
  { status: "executed"; leadId: string; recordId: string } | { status: "executed"; actionType: "update_lead"; leadId: string; recordId: string }
> {
  if (!("leadId" in execution) || !("recordId" in execution)) {
    return false;
  }

  return !("actionType" in execution) || execution.actionType === "update_lead";
}

function getPreviewString(action: AssistantActionWriteDraft, field: string): string | null {
  const value = action.preview.changes.find((change) => change.field === field)?.to;
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
