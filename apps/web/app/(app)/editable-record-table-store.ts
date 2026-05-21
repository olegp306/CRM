export type EditableTableFieldType = "text" | "textarea" | "date" | "number" | "email" | "url";

export type EditableTableField = {
  key: string;
  label: string;
  type: EditableTableFieldType;
  table: boolean;
  editable: boolean;
  width?: number;
  required?: boolean;
};

export type EditableRecord = {
  id: string;
  [key: string]: unknown;
};

export type EditableRecordRow = {
  id: string;
  [key: string]: string;
};

export type EditableRecordKind = "clients" | "leads" | "projects" | "coldTargets";

export function createEditableRecordRows(fields: EditableTableField[], records: EditableRecord[]): EditableRecordRow[] {
  return records.map((record) => {
    const row: EditableRecordRow = { id: record.id };

    for (const field of fields) {
      row[field.key] = formatEditableValue(record[field.key], field.type);
    }

    return row;
  });
}

export function getEditableEmptyStateMessage(kind: EditableRecordKind): string {
  const labels: Record<EditableRecordKind, string> = {
    clients: "clients",
    leads: "leads",
    projects: "projects",
    coldTargets: "cold targets"
  };

  return `No ${labels[kind]} found yet.`;
}

function formatEditableValue(value: unknown, type: EditableTableFieldType): string {
  if (value === null || value === undefined) return "";

  if (type === "date") {
    const date = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
  }

  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);

  if (typeof value === "object" && "toString" in value && typeof value.toString === "function") {
    return value.toString();
  }

  return String(value);
}
