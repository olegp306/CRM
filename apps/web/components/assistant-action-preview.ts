import type { ActionPreview } from "@app/assistant";

export type AssistantActionPreviewRow = {
  label: string;
  value: string;
};

const fieldLabels: Record<string, string> = {
  "document.selectedRecordIds": "Lead",
  "document.sourceText": "Source",
  "document.type": "Document",
  "lead.selectedRecordIds": "Lead",
  "lead.sourceText": "Source",
  "project.selectedRecordIds": "Project",
  "task.sourceText": "Source",
  "followup.sourceText": "Source"
};

export function getAssistantActionPreviewRows(actionPreview: ActionPreview): AssistantActionPreviewRow[] {
  return actionPreview.changes
    .map((change) => ({
      label: fieldLabels[change.field] ?? change.field,
      value: formatAssistantPreviewValue(change.to)
    }))
    .filter((row) => row.value.length > 0);
}

function formatAssistantPreviewValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).join(", ");
  }

  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}
