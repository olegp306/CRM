export function getAssistantSelectedRecordIds(pathname: string, searchParams: URLSearchParams): string[] {
  if (pathname !== "/leads") {
    return [];
  }

  const leadId = searchParams.get("leadId")?.trim();
  return leadId ? [leadId] : [];
}

export function shouldUseOnboardingAssistantAction({
  historyLength,
  content,
  attachmentCount
}: {
  historyLength: number;
  content: string;
  attachmentCount: number;
}): boolean {
  if (historyLength > 0) {
    return false;
  }

  if (attachmentCount > 0) {
    return false;
  }

  const trimmed = content.trim();
  if (/^\/(?:start|help|newlead|new_lead|lead)\b/i.test(trimmed) || /^new lead$/i.test(trimmed)) {
    return false;
  }

  if (isFirstMessageLeadSourceMaterial(trimmed)) {
    return false;
  }

  return true;
}

function isFirstMessageLeadSourceMaterial(content: string): boolean {
  return (
    /\b(?:create|capture|register|import)\s+(?:a\s+)?lead\b/i.test(content) &&
    /\b(?:source material|client request|from this|bgf|commercial proposal|proposal|address|phone|email)\b/i.test(content)
  );
}
