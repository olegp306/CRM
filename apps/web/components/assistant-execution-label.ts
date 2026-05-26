import type { ExecuteAssistantActionResult } from "@app/assistant";

export type AssistantExecutionButton = {
  label: string;
  url: string;
};

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

export function getAssistantExecutionButtons(execution: ExecuteAssistantActionResult): AssistantExecutionButton[] {
  if ("leadId" in execution) {
    const buttons: AssistantExecutionButton[] = [{ label: "CRM", url: `/leads?leadId=${encodeURIComponent(execution.leadId)}` }];

    if ("actionType" in execution) {
      return buttons;
    }

    if (execution.pdfAttachmentId) {
      buttons.push({ label: "PDF", url: `/documents/attachments/${encodeURIComponent(execution.pdfAttachmentId)}` });
    }

    if (execution.docxAttachmentId) {
      buttons.push({ label: "DOC", url: `/documents/attachments/${encodeURIComponent(execution.docxAttachmentId)}?download=1` });
    }

    return buttons;
  }

  return [];
}
