import { createLeadChatActionButtons, createLeadChatActions, type ExecuteAssistantActionResult } from "@app/assistant";

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
    if ("actionType" in execution) {
      return createLeadChatActionButtons(createLeadChatActions({ leadId: execution.leadId })).flatMap((button) =>
        button.url ? [{ label: button.label, url: button.url }] : []
      );
    }

    return createLeadChatActionButtons(
      createLeadChatActions({
        leadId: execution.leadId,
        kpReady: true,
        pdfUrl: execution.pdfAttachmentId ? `/documents/attachments/${encodeURIComponent(execution.pdfAttachmentId)}` : undefined,
        docxUrl: execution.docxAttachmentId ? `/documents/attachments/${encodeURIComponent(execution.docxAttachmentId)}?download=1` : undefined
      })
    ).flatMap((button) => (button.url ? [{ label: button.label, url: button.url }] : []));
  }

  return [];
}
