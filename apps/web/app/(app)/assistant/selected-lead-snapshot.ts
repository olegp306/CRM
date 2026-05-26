import type { CreatedLeadRecord, GeneratedKpDocumentRecord, LeadChatSnapshot } from "@app/assistant";

export function createSelectedLeadChatSnapshot(
  selectedLeadId: string | null | undefined,
  leads: CreatedLeadRecord[],
  generatedDocuments: GeneratedKpDocumentRecord[]
): LeadChatSnapshot | null {
  const leadId = selectedLeadId?.trim();
  if (!leadId) {
    return null;
  }

  const lead = leads.find((item) => item.leadId === leadId);
  if (!lead) {
    return null;
  }

  const document = generatedDocuments.find((item) => item.sourceRecordIds.includes(lead.leadId));
  const missingFields = lead.missingData ?? [];
  const kpReady = missingFields.length === 0;

  return {
    leadId: lead.leadId,
    missingFields,
    kpReady,
    pdfUrl: document?.pdfAttachmentId ? `/documents/attachments/${encodeURIComponent(document.pdfAttachmentId)}` : undefined,
    docxUrl: document?.docxAttachmentId ? `/documents/attachments/${encodeURIComponent(document.docxAttachmentId)}?download=1` : undefined,
    canSendKp: kpReady && Boolean(document?.pdfAttachmentId || document?.docxAttachmentId),
    kpSent: lead.status === "kp_sent",
    clientEmail: lead.email ?? null
  };
}
