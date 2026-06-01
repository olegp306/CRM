export function getAssistantLeadTargetId(content: string, selectedRecordIds?: string[] | null): string | null {
  const selectedLeadId = selectedRecordIds?.find((id) => /^L-\d{4}-\d+$/i.test(id.trim()));
  if (selectedLeadId) {
    return selectedLeadId.trim().toUpperCase();
  }

  return /\b(L-\d{4}-\d+)\b/i.exec(content)?.[1]?.toUpperCase() ?? null;
}
