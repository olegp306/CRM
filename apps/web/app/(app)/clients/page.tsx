import { EditableRecordTable } from "../editable-record-table";
import { createEditableRecordRows, type EditableTableField } from "../editable-record-table-store";
import { getWorkspaceSession } from "../../workspace-session";
import { prisma } from "@app/db";
import { updateClientAction } from "./actions";

const clientFields: EditableTableField[] = [
  { key: "clientId", label: "Client ID", type: "text", table: true, editable: false, width: 132 },
  { key: "createdDate", label: "Created", type: "date", table: true, editable: false, width: 124 },
  { key: "name", label: "Name", type: "text", table: true, editable: true, required: true, width: 220 },
  { key: "clientType", label: "Type", type: "text", table: true, editable: true, required: true, width: 132 },
  { key: "status", label: "Status", type: "text", table: true, editable: true, required: true, width: 132 },
  { key: "language", label: "Language", type: "text", table: true, editable: true, width: 112 },
  { key: "email", label: "Email", type: "email", table: true, editable: true, width: 220 },
  { key: "phone", label: "Phone", type: "text", table: true, editable: true, width: 180 },
  { key: "whatsapp", label: "WhatsApp", type: "text", table: false, editable: true },
  { key: "address", label: "Address", type: "text", table: true, editable: true, width: 260 },
  { key: "source", label: "Source", type: "text", table: true, editable: true, width: 160 },
  { key: "referredBy", label: "Referred by", type: "text", table: false, editable: true },
  { key: "notes", label: "Notes", type: "textarea", table: false, editable: true }
];

export default async function ClientsPage() {
  const session = await getWorkspaceSession();
  const clients = await prisma.client.findMany({
    where: { workspaceId: session.workspaceId, archivedAt: null },
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
  const rows = createEditableRecordRows(clientFields, clients);

  return (
    <section className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Clients</h1>
        <p className="text-sm text-muted-foreground">People and companies connected to leads and projects.</p>
      </div>
      <EditableRecordTable title="Clients table" kind="clients" fields={clientFields} rows={rows} updateAction={updateClientAction} />
    </section>
  );
}
