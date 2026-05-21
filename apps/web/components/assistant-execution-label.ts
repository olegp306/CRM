import type { ExecuteAssistantActionResult } from "@app/assistant";

export function getAssistantExecutionLabel(execution: ExecuteAssistantActionResult): string {
  if ("leadId" in execution) {
    return execution.leadId;
  }

  if ("taskUpdateId" in execution) {
    return execution.taskUpdateId;
  }

  if ("documentId" in execution) {
    return execution.documentId;
  }

  return execution.followupId;
}
