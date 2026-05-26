import { prisma } from "@app/db";
import { getWorkspaceSession } from "@/app/workspace-session";
import { createEditableRecordRows, type EditableRecord, type EditableTableField } from "../../editable-record-table-store";
import { createLeadTableRows, leadTableColumns, type LeadTableRecord } from "../../leads/lead-table-store";
import { createCsvDownloadFilename, createCsvExport, type CsvExportColumn, type CsvExportRow } from "../../table-export";

type ExportKind = "leads" | "clients" | "projects" | "cold-targets";

export async function GET(request: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind: rawKind } = await params;
  const kind = normalizeExportKind(rawKind);

  if (!kind) {
    return new Response("Unknown export kind", { status: 404 });
  }

  const session = await getWorkspaceSession();
  const exportData = await createTableExportData(kind, session.workspaceId);
  const csv = createCsvExport(exportData.columns, exportData.rows);

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${createCsvDownloadFilename(kind)}"`
    }
  });
}

async function createTableExportData(kind: ExportKind, workspaceId: string): Promise<{ columns: CsvExportColumn[]; rows: CsvExportRow[] }> {
  if (kind === "leads") {
    const records = await prisma.lead.findMany({
      where: { workspaceId, archivedAt: null },
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

    return {
      columns: leadTableColumns.map((column) => ({ key: column.key, label: column.label })),
      rows: createLeadTableRows(records as LeadTableRecord[])
    };
  }

  if (kind === "clients") {
    const records = await prisma.client.findMany({
      where: { workspaceId, archivedAt: null },
      orderBy: [{ createdDate: "desc" }, { clientId: "asc" }],
      select: {
        id: true,
        clientId: true,
        createdDate: true,
        name: true,
        clientType: true,
        status: true,
        language: true,
        whatsapp: true,
        email: true,
        phone: true,
        address: true,
        source: true,
        referredBy: true,
        notes: true
      }
    });

    return createEditableExportData(clientExportFields, records);
  }

  if (kind === "projects") {
    const records = await prisma.project.findMany({
      where: { workspaceId, archivedAt: null },
      orderBy: [{ createdAt: "desc" }, { projectId: "asc" }],
      select: {
        id: true,
        projectId: true,
        createdAt: true,
        projectName: true,
        status: true,
        currentPhase: true,
        projectType: true,
        projectAddress: true,
        bgfM2: true,
        wohnflaecheM2: true,
        totalNetEur: true,
        totalGrossEur: true,
        notes: true
      }
    });

    return createEditableExportData(projectExportFields, records);
  }

  const records = await prisma.coldTarget.findMany({
    where: { workspaceId, archivedAt: null },
    orderBy: [{ fitScore: "desc" }, { targetId: "asc" }],
    select: {
      id: true,
      targetId: true,
      createdAt: true,
      companyName: true,
      website: true,
      region: true,
      address: true,
      contactPerson: true,
      contactRole: true,
      email: true,
      phone: true,
      linkedinUrl: true,
      fitScore: true,
      priority: true,
      notesResearch: true,
      currentTouch: true,
      nextActionDate: true,
      nextActionType: true,
      lastResponse: true,
      outcome: true,
      nextReviewDate: true
    }
  });

  return createEditableExportData(coldTargetExportFields, records);
}

function createEditableExportData(fields: EditableTableField[], records: EditableRecord[]): { columns: CsvExportColumn[]; rows: CsvExportRow[] } {
  return {
    columns: fields.map((field) => ({ key: field.key, label: field.label })),
    rows: createEditableRecordRows(fields, records)
  };
}

function normalizeExportKind(kind: string): ExportKind | null {
  return kind === "leads" || kind === "clients" || kind === "projects" || kind === "cold-targets" ? kind : null;
}

const clientExportFields: EditableTableField[] = [
  { key: "clientId", label: "Client ID", type: "text", table: true, editable: false },
  { key: "createdDate", label: "Created", type: "date", table: true, editable: false },
  { key: "name", label: "Name", type: "text", table: true, editable: true },
  { key: "clientType", label: "Type", type: "text", table: true, editable: true },
  { key: "status", label: "Status", type: "text", table: true, editable: true },
  { key: "language", label: "Language", type: "text", table: true, editable: true },
  { key: "email", label: "Email", type: "email", table: true, editable: true },
  { key: "phone", label: "Phone", type: "text", table: true, editable: true },
  { key: "address", label: "Address", type: "text", table: true, editable: true },
  { key: "source", label: "Source", type: "text", table: true, editable: true },
  { key: "referredBy", label: "Referred by", type: "text", table: false, editable: true },
  { key: "notes", label: "Notes", type: "textarea", table: false, editable: true }
];

const projectExportFields: EditableTableField[] = [
  { key: "projectId", label: "Project ID", type: "text", table: true, editable: false },
  { key: "createdAt", label: "Created", type: "date", table: true, editable: false },
  { key: "projectName", label: "Project name", type: "text", table: true, editable: true },
  { key: "status", label: "Status", type: "text", table: true, editable: true },
  { key: "currentPhase", label: "Current phase", type: "text", table: true, editable: true },
  { key: "projectType", label: "Type", type: "text", table: true, editable: true },
  { key: "projectAddress", label: "Address", type: "text", table: true, editable: true },
  { key: "bgfM2", label: "BGF m2", type: "number", table: true, editable: true },
  { key: "wohnflaecheM2", label: "Wohnflaeche m2", type: "number", table: true, editable: true },
  { key: "totalNetEur", label: "Total net EUR", type: "number", table: true, editable: true },
  { key: "totalGrossEur", label: "Total gross EUR", type: "number", table: true, editable: true },
  { key: "notes", label: "Notes", type: "textarea", table: false, editable: true }
];

const coldTargetExportFields: EditableTableField[] = [
  { key: "targetId", label: "Target ID", type: "text", table: true, editable: false },
  { key: "createdAt", label: "Created", type: "date", table: true, editable: false },
  { key: "companyName", label: "Company", type: "text", table: true, editable: true },
  { key: "fitScore", label: "Fit", type: "number", table: true, editable: true },
  { key: "priority", label: "Priority", type: "text", table: true, editable: true },
  { key: "region", label: "Region", type: "text", table: true, editable: true },
  { key: "contactPerson", label: "Contact", type: "text", table: true, editable: true },
  { key: "contactRole", label: "Role", type: "text", table: true, editable: true },
  { key: "email", label: "Email", type: "email", table: true, editable: true },
  { key: "phone", label: "Phone", type: "text", table: true, editable: true },
  { key: "currentTouch", label: "Touch", type: "number", table: true, editable: true },
  { key: "nextActionDate", label: "Next action", type: "date", table: true, editable: true },
  { key: "nextActionType", label: "Action type", type: "text", table: true, editable: true },
  { key: "outcome", label: "Outcome", type: "text", table: true, editable: true },
  { key: "website", label: "Website", type: "url", table: false, editable: true },
  { key: "address", label: "Address", type: "text", table: false, editable: true },
  { key: "linkedinUrl", label: "LinkedIn", type: "url", table: false, editable: true },
  { key: "notesResearch", label: "Research notes", type: "textarea", table: false, editable: true },
  { key: "lastResponse", label: "Last response", type: "textarea", table: false, editable: true },
  { key: "nextReviewDate", label: "Next review", type: "date", table: false, editable: true }
];
