import { prisma } from "@app/db";
import { getWorkspaceSession } from "../../workspace-session";
import { markLeadKpSentAction, undoLeadKpSentAction, updateLeadAction } from "./actions";
import { LeadsTable } from "./leads-table";
import { createLeadTableRows } from "./lead-table-store";

export default async function LeadsPage() {
  const session = await getWorkspaceSession();
  const leadRecords = await prisma.lead.findMany({
    where: { workspaceId: session.workspaceId, archivedAt: null },
    orderBy: [{ createdDate: "desc" }, { leadId: "asc" }],
    select: {
      id: true,
      leadId: true,
      clientRecordId: true,
      createdDate: true,
      temperature: true,
      requestType: true,
      urgency: true,
      budgetEur: true,
      desiredStart: true,
      desiredMoveIn: true,
      bgfM2: true,
      wohnflaecheM2: true,
      projectAddress: true,
      isStandard: true,
      status: true,
      rawInput: true,
      missingData: true,
      kpGeneratedDocumentId: true,
      kpSentDate: true,
      followup1Date: true,
      followupStatus: true,
      outcome: true,
      outcomeReason: true,
      projectRecordId: true
    }
  });
  const leadBusinessIds = leadRecords.map((lead) => lead.leadId);
  const generatedDocuments = leadBusinessIds.length > 0
    ? await prisma.generatedDocument.findMany({
        where: {
          workspaceId: session.workspaceId,
          documentType: "kp",
          sourceType: "assistant",
          sourceId: { in: leadBusinessIds }
        },
        select: {
          inputSnapshot: true,
          docxAttachmentId: true,
          pdfAttachmentId: true
        }
      })
    : [];
  const leadRows = createLeadTableRows(
    leadRecords,
    generatedDocuments
      .map((document) => ({
        documentId: extractGeneratedDocumentId(document.inputSnapshot),
        docxAttachmentId: document.docxAttachmentId,
        pdfAttachmentId: document.pdfAttachmentId
      }))
      .filter((document) => document.documentId)
  );

  return (
    <section>
      <LeadsTable
        rows={leadRows}
        updateLeadAction={updateLeadAction}
        markLeadKpSentAction={markLeadKpSentAction}
        undoLeadKpSentAction={undoLeadKpSentAction}
      />
    </section>
  );
}

function extractGeneratedDocumentId(inputSnapshot: unknown): string {
  if (!inputSnapshot || typeof inputSnapshot !== "object") {
    return "";
  }

  const snapshot = inputSnapshot as Record<string, unknown>;
  return typeof snapshot.documentId === "string" ? snapshot.documentId : "";
}
