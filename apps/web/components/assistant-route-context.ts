type AssistantResponseButtonLike = {
  label: string;
  url?: string;
  action?: string;
  value?: string;
};

export type AssistantResponseButtonUiAction = "confirm" | "cancel" | "open_upload" | "set_theme" | "link" | "none";
const attachmentOnlySourceMaterialContent = "Please review this source material and create a lead if the data is sufficient.";

export function getAssistantSelectedRecordIds(pathname: string, searchParams: URLSearchParams): string[] {
  if (pathname !== "/leads") {
    return [];
  }

  const leadId = searchParams.get("leadId")?.trim();
  return leadId ? [leadId] : [];
}

export function getAssistantResponseButtonUiAction(button: AssistantResponseButtonLike): AssistantResponseButtonUiAction {
  if (button.url) {
    return "link";
  }

  if (button.action === "confirm" || button.action === "cancel" || button.action === "open_upload" || button.action === "set_theme") {
    return button.action;
  }

  return "none";
}

export function getAssistantSubmitContent(content: string, attachmentCount: number): string {
  const trimmed = content.trim();
  return trimmed || (attachmentCount > 0 ? attachmentOnlySourceMaterialContent : "");
}

export function isAssistantSubmitDisabled({
  content,
  attachmentCount,
  submitting
}: {
  content: string;
  attachmentCount: number;
  submitting: boolean;
}): boolean {
  return submitting || getAssistantSubmitContent(content, attachmentCount).length === 0;
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

  if (isFirstMessageCapabilityRequest(trimmed)) {
    return false;
  }

  if (isFirstMessageLeadSourceMaterial(trimmed)) {
    return false;
  }

  return true;
}

function isFirstMessageCapabilityRequest(content: string): boolean {
  return (
    /\b(?:theme|dark mode|night mode|evening theme|color scheme|appearance|graphite|nocturne)\b/i.test(content) ||
    /(тема|темн\w*|ночн\w*\s+режим|вечерн\w*\s+тем|цветов\w*\s+схем|оформлен|внешн\w*\s+вид)/i.test(content)
  );
}

function isFirstMessageLeadSourceMaterial(content: string): boolean {
  return (
    /\b(?:create|capture|register|import)\s+(?:a\s+)?lead\b/i.test(content) &&
    /\b(?:source material|client request|from this|bgf|commercial proposal|proposal|address|phone|email)\b/i.test(content)
  );
}
