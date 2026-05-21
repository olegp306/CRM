import { describe, expect, it } from "vitest";
import {
  createEditableRecordRows,
  getEditableEmptyStateMessage,
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
});
