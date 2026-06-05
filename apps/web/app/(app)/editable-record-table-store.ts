export type EditableTableFieldType = "text" | "textarea" | "date" | "number" | "email" | "url";
export type EditableTableFieldOwner = "record" | "linked" | "derived";

export type EditableTableField = {
  key: string;
  label: string;
  type: EditableTableFieldType;
  table: boolean;
  editable: boolean;
  owner?: EditableTableFieldOwner;
  ownerLabel?: string;
  ownerTooltip?: string;
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

const editableMobileCardFields: Record<EditableRecordKind, string[]> = {
  clients: ["createdDate", "status", "name", "email", "phone"],
  leads: ["createdDate", "status", "requestType", "projectAddress", "source"],
  projects: ["createdAt", "status", "projectName", "currentPhase", "projectAddress"],
  coldTargets: ["createdAt", "priority", "companyName", "contactPerson", "nextActionDate"]
};

export function createEditableRecordRows(fields: EditableTableField[], records: EditableRecord[]): EditableRecordRow[] {
  return records.map((record) => {
    const row: EditableRecordRow = { id: record.id };

    for (const field of fields) {
      row[field.key] = formatEditableValue(record[field.key], field.type);
    }

    return row;
  });
}

export function getEditableMobileCardFields(kind: EditableRecordKind, fields: EditableTableField[]): EditableTableField[] {
  const preferredKeys = editableMobileCardFields[kind];
  const tableFields = fields.filter((field) => field.table);
  const preferredFields = preferredKeys
    .map((key) => tableFields.find((field) => field.key === key))
    .filter((field): field is EditableTableField => Boolean(field));

  if (preferredFields.length > 0) {
    return preferredFields.slice(0, 5);
  }

  return tableFields.slice(0, 5);
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

export function getEditableFieldOwner(field: EditableTableField): EditableTableFieldOwner {
  return field.owner ?? "record";
}

export function getEditableFieldOwnerLabel(field: EditableTableField): string | undefined {
  const owner = getEditableFieldOwner(field);

  if (owner === "linked") {
    return field.ownerLabel ?? "Linked";
  }

  if (owner === "derived") {
    return field.ownerLabel ?? "Auto";
  }

  return undefined;
}

export function getEditableFieldOwnerTooltip(field: EditableTableField): string | undefined {
  if (field.ownerTooltip) {
    return field.ownerTooltip;
  }

  const owner = getEditableFieldOwner(field);

  if (owner === "linked") {
    return `${field.label} comes from a linked CRM table. Edits here update the source record when the link is available.`;
  }

  if (owner === "derived") {
    return `${field.label} is calculated automatically from CRM data and is refreshed when the source data changes.`;
  }

  return undefined;
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
