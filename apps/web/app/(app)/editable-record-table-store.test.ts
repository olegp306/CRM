import { describe, expect, it } from "vitest";
import {
  createEditableRecordRows,
  getEditableEmptyStateMessage,
  getEditableFieldOwner,
  getEditableFieldOwnerLabel,
  getEditableFieldOwnerTooltip,
  getEditableMobileCardFields,
  type EditableTableField
} from "./editable-record-table-store";

const fields: EditableTableField[] = [
  { key: "name", label: "Name", type: "text", table: true, editable: true },
  { key: "status", label: "Status", type: "text", table: true, editable: true },
  { key: "notes", label: "Notes", type: "textarea", table: false, editable: true },
  { key: "nextActionDate", label: "Next action", type: "date", table: true, editable: true }
];

describe("editable record table store", () => {
  it("maps records into string rows for table display and editing", () => {
    const rows = createEditableRecordRows(fields, [
      {
        id: "record-1",
        name: "Projektbau Chiemgau",
        status: "active",
        notes: null,
        nextActionDate: new Date("2026-06-02T12:00:00.000Z")
      }
    ]);

    expect(rows).toEqual([
      {
        id: "record-1",
        name: "Projektbau Chiemgau",
        status: "active",
        notes: "",
        nextActionDate: "2026-06-02"
      }
    ]);
  });

  it("keeps non-table editable fields available for the row editor", () => {
    const rows = createEditableRecordRows(fields, [
      {
        id: "record-2",
        name: "Anna Beispiel",
        status: "active",
        notes: "Prefers WhatsApp",
        nextActionDate: null
      }
    ]);

    expect(rows[0].notes).toBe("Prefers WhatsApp");
    expect(fields.filter((field) => field.editable).map((field) => field.key)).toEqual([
      "name",
      "status",
      "notes",
      "nextActionDate"
    ]);
  });

  it("returns explicit empty-state copy for the first four CRM tabs", () => {
    expect(getEditableEmptyStateMessage("clients")).toBe("No clients found yet.");
    expect(getEditableEmptyStateMessage("leads")).toBe("No leads found yet.");
    expect(getEditableEmptyStateMessage("projects")).toBe("No projects found yet.");
    expect(getEditableEmptyStateMessage("coldTargets")).toBe("No cold targets found yet.");
  });

  it("selects compact mobile card fields from visible table fields", () => {
    expect(
      getEditableMobileCardFields("clients", [
        { key: "clientId", label: "Client ID", type: "text", table: true, editable: false },
        { key: "createdDate", label: "Created", type: "date", table: true, editable: false },
        { key: "name", label: "Name", type: "text", table: true, editable: true },
        { key: "status", label: "Status", type: "text", table: true, editable: true },
        { key: "email", label: "Email", type: "email", table: true, editable: true },
        { key: "notes", label: "Notes", type: "textarea", table: false, editable: true }
      ]).map((field) => field.key)
    ).toEqual(["createdDate", "status", "name", "email"]);
  });

  it("provides shared owner labels and hover copy for linked and auto fields", () => {
    const linkedField: EditableTableField = {
      key: "clientName",
      label: "Client",
      type: "text",
      table: true,
      editable: true,
      owner: "linked",
      ownerLabel: "Client"
    };
    const derivedField: EditableTableField = {
      key: "projectCount",
      label: "Projects",
      type: "number",
      table: true,
      editable: false,
      owner: "derived",
      ownerTooltip: "Projects is calculated from linked leads."
    };

    expect(getEditableFieldOwner(fields[0])).toBe("record");
    expect(getEditableFieldOwnerLabel(linkedField)).toBe("Client");
    expect(getEditableFieldOwnerTooltip(linkedField)).toContain("linked CRM table");
    expect(getEditableFieldOwnerLabel(derivedField)).toBe("Auto");
    expect(getEditableFieldOwnerTooltip(derivedField)).toBe("Projects is calculated from linked leads.");
    expect(getEditableFieldOwnerTooltip(fields[0])).toBeUndefined();
  });
});
