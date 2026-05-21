import { EditableRecordTable } from "../editable-record-table";
import { createEditableRecordRows, type EditableTableField } from "../editable-record-table-store";
import { getWorkspaceSession } from "../../workspace-session";
import { prisma } from "@app/db";
import { updateProjectAction } from "./actions";

const projectFields: EditableTableField[] = [
  { key: "projectId", label: "Project ID", type: "text", table: true, editable: false, width: 132 },
  { key: "projectName", label: "Project name", type: "text", table: true, editable: true, required: true, width: 240 },
  { key: "status", label: "Status", type: "text", table: true, editable: true, required: true, width: 132 },
  { key: "currentPhase", label: "Current phase", type: "text", table: true, editable: true, width: 180 },
  { key: "projectType", label: "Type", type: "text", table: true, editable: true, width: 144 },
  { key: "projectAddress", label: "Address", type: "text", table: true, editable: true, width: 260 },
  { key: "bgfM2", label: "BGF m2", type: "number", table: true, editable: true, width: 112 },
  { key: "wohnflaecheM2", label: "Wohnflaeche m2", type: "number", table: true, editable: true, width: 152 },
  { key: "totalNetEur", label: "Total net EUR", type: "number", table: true, editable: true, width: 152 },
  { key: "totalGrossEur", label: "Total gross EUR", type: "number", table: true, editable: true, width: 164 },
  { key: "notes", label: "Notes", type: "textarea", table: false, editable: true }
];

export default async function ProjectsPage() {
  const session = await getWorkspaceSession();
  const projects = await prisma.project.findMany({
    where: { workspaceId: session.workspaceId, archivedAt: null },
    orderBy: [{ createdAt: "desc" }, { projectId: "asc" }],
    select: {
      id: true,
      projectId: true,
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
  const rows = createEditableRecordRows(projectFields, projects);

  return (
    <section className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Projects</h1>
        <p className="text-sm text-muted-foreground">Project operations, tasks, decisions, and documents.</p>
      </div>
      <EditableRecordTable title="Projects table" kind="projects" fields={projectFields} rows={rows} updateAction={updateProjectAction} />
    </section>
  );
}
