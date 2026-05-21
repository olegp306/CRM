import { revalidatePath } from "next/cache";
import { parseColdTargetCsv } from "@app/core";
import { prisma } from "@app/db";
import { getWorkspaceSession } from "../../workspace-session";
import { EditableRecordTable } from "../editable-record-table";
import { createEditableRecordRows, type EditableTableField } from "../editable-record-table-store";

const coldTargetFields: EditableTableField[] = [
  { key: "targetId", label: "Target ID", type: "text", table: true, editable: false, width: 132 },
  { key: "companyName", label: "Company", type: "text", table: true, editable: true, required: true, width: 240 },
  { key: "fitScore", label: "Fit", type: "number", table: true, editable: true, width: 96 },
  { key: "priority", label: "Priority", type: "text", table: true, editable: true, width: 120 },
  { key: "region", label: "Region", type: "text", table: true, editable: true, width: 160 },
  { key: "contactPerson", label: "Contact", type: "text", table: true, editable: true, width: 180 },
  { key: "contactRole", label: "Role", type: "text", table: true, editable: true, width: 160 },
  { key: "email", label: "Email", type: "email", table: true, editable: true, width: 220 },
  { key: "phone", label: "Phone", type: "text", table: true, editable: true, width: 160 },
  { key: "currentTouch", label: "Touch", type: "number", table: true, editable: true, width: 104 },
  { key: "nextActionDate", label: "Next action", type: "date", table: true, editable: true, width: 144 },
  { key: "nextActionType", label: "Action type", type: "text", table: true, editable: true, width: 152 },
  { key: "outcome", label: "Outcome", type: "text", table: true, editable: true, width: 132 },
  { key: "website", label: "Website", type: "url", table: false, editable: true },
  { key: "address", label: "Address", type: "text", table: false, editable: true },
  { key: "linkedinUrl", label: "LinkedIn", type: "url", table: false, editable: true },
  { key: "notesResearch", label: "Research notes", type: "textarea", table: false, editable: true },
  { key: "lastResponse", label: "Last response", type: "textarea", table: false, editable: true },
  { key: "nextReviewDate", label: "Next review", type: "date", table: false, editable: true }
];

async function readImportText(formData: FormData, textField: string, fileField: string): Promise<string> {
  const file = formData.get(fileField);
  if (file instanceof File && file.size > 0) {
    return file.text();
  }

  return String(formData.get(textField) ?? "");
}

async function replaceColdTargets(formData: FormData) {
  "use server";

  const session = await getWorkspaceSession();
  const input = await readImportText(formData, "coldTargetsText", "coldTargetsFile");
  const preview = parseColdTargetCsv(input);

  if (preview.warnings.length > 0) {
    throw new Error(preview.warnings.map((warning) => `Row ${warning.rowNumber}: ${warning.message}`).join("\n"));
  }

  await prisma.outreachTouch.deleteMany({ where: { workspaceId: session.workspaceId } });
  await prisma.coldTarget.deleteMany({ where: { workspaceId: session.workspaceId } });
  await prisma.coldTarget.createMany({
    data: preview.rows.map((target) => ({
      workspaceId: session.workspaceId,
      targetId: target.targetId,
      companyName: target.companyName,
      website: target.website,
      region: target.region,
      address: target.address,
      contactPerson: target.contactPerson,
      contactRole: target.contactRole,
      email: target.email,
      phone: target.phone,
      linkedinUrl: target.linkedinUrl,
      fitScore: target.fitScore,
      priority: target.priority,
      notesResearch: target.notesResearch,
      currentTouch: 1
    }))
  });

  revalidatePath("/outreach");
}

async function updateColdTargetAction(formData: FormData) {
  "use server";

  const session = await getWorkspaceSession();
  const id = getRequiredFormValue(formData, "id");

  await prisma.coldTarget.update({
    where: { id, workspaceId: session.workspaceId },
    data: {
      companyName: getRequiredFormValue(formData, "companyName"),
      website: getOptionalFormValue(formData, "website"),
      region: getOptionalFormValue(formData, "region"),
      address: getOptionalFormValue(formData, "address"),
      contactPerson: getOptionalFormValue(formData, "contactPerson"),
      contactRole: getOptionalFormValue(formData, "contactRole"),
      email: getOptionalFormValue(formData, "email"),
      phone: getOptionalFormValue(formData, "phone"),
      linkedinUrl: getOptionalFormValue(formData, "linkedinUrl"),
      fitScore: getOptionalIntFormValue(formData, "fitScore"),
      priority: getOptionalFormValue(formData, "priority"),
      notesResearch: getOptionalFormValue(formData, "notesResearch"),
      currentTouch: getOptionalIntFormValue(formData, "currentTouch"),
      nextActionDate: getOptionalDateFormValue(formData, "nextActionDate"),
      nextActionType: getOptionalFormValue(formData, "nextActionType"),
      lastResponse: getOptionalFormValue(formData, "lastResponse"),
      outcome: getOptionalFormValue(formData, "outcome"),
      nextReviewDate: getOptionalDateFormValue(formData, "nextReviewDate")
    }
  });

  revalidatePath("/outreach");
}

export default async function OutreachPage() {
  const session = await getWorkspaceSession();
  const targets = await prisma.coldTarget.findMany({
    where: { workspaceId: session.workspaceId, archivedAt: null },
    orderBy: [{ fitScore: "desc" }, { targetId: "asc" }],
    select: {
      id: true,
      targetId: true,
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
  const rows = createEditableRecordRows(coldTargetFields, targets);

  return (
    <section className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Cold Targets</h1>
        <p className="text-sm text-muted-foreground">Cold targets and cadence execution.</p>
      </div>

      <form action={replaceColdTargets} className="grid gap-3 rounded-lg border border-border bg-white p-4">
        <textarea
          name="coldTargetsText"
          className="min-h-32 rounded-md border border-border px-3 py-2 text-sm"
          placeholder="Paste target_id TSV or CSV here"
        />
        <div className="flex flex-wrap items-center gap-3">
          <input name="coldTargetsFile" type="file" accept=".csv,.tsv,.txt" className="text-sm" />
          <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            Replace targets
          </button>
        </div>
      </form>

      <EditableRecordTable
        title="Cold targets table"
        kind="coldTargets"
        fields={coldTargetFields}
        rows={rows}
        updateAction={updateColdTargetAction}
      />
    </section>
  );
}

function getOptionalFormValue(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getRequiredFormValue(formData: FormData, key: string): string {
  const value = getOptionalFormValue(formData, key);
  if (!value) {
    throw new Error(`${key} is required.`);
  }

  return value;
}

function getOptionalIntFormValue(formData: FormData, key: string): number | null {
  const value = getOptionalFormValue(formData, key);
  if (!value) return null;

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function getOptionalDateFormValue(formData: FormData, key: string): Date | null {
  const value = getOptionalFormValue(formData, key);
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}
