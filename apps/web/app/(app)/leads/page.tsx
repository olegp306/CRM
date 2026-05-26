import { prisma } from "@app/db";
import { getWorkspaceSession } from "../../workspace-session";
import { markLeadKpSentAction, undoLeadKpSentAction, updateLeadAction } from "./actions";
import { LeadsTable } from "./leads-table";
import { createLeadTableRows, type LeadChannelEventsByLeadId } from "./lead-table-store";

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
  const channelEventAuditLogs = leadBusinessIds.length > 0
    ? await prisma.auditLog.findMany({
        where: {
          workspaceId: session.workspaceId,
          action: "assistant.channel.event",
          targetType: "AssistantChannelEvent"
        },
        orderBy: { createdAt: "asc" },
        select: {
          createdAt: true,
          metadata: true
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
      .filter((document) => document.documentId),
    createLeadChannelEventsByLeadId(channelEventAuditLogs, leadBusinessIds)
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

function createLeadChannelEventsByLeadId(
  auditLogs: Array<{ createdAt: Date; metadata: unknown }>,
  leadIds: string[]
): LeadChannelEventsByLeadId {
  const leadIdSet = new Set(leadIds);
  const eventsByLeadId: LeadChannelEventsByLeadId = {};

  for (const auditLog of auditLogs) {
    const metadata = auditLog.metadata;
    if (!metadata || typeof metadata !== "object" || !("leadId" in metadata)) {
      continue;
    }

    const leadId = String((metadata as { leadId?: unknown }).leadId ?? "");
    if (!leadIdSet.has(leadId)) {
      continue;
    }

    eventsByLeadId[leadId] = [
      ...(eventsByLeadId[leadId] ?? []),
      {
        createdAt: auditLog.createdAt.toISOString(),
        metadata
      }
    ];
  }

  return eventsByLeadId;
}

function extractGeneratedDocumentId(inputSnapshot: unknown): string {
  if (!inputSnapshot || typeof inputSnapshot !== "object") {
    return "";
  }

  const snapshot = inputSnapshot as Record<string, unknown>;
  return typeof snapshot.documentId === "string" ? snapshot.documentId : "";
}
