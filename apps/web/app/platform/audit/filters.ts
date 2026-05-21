import type { AuditReviewFilters, AssistantAuditEventDraft } from "@app/assistant";

const actions = new Set<AssistantAuditEventDraft["action"]>([
  "assistant.action.executed",
  "assistant.action.preview_created",
  "assistant.message.submitted"
]);

export type PlatformAuditSearchParams = {
  action?: string | string[];
  actor?: string | string[];
  q?: string | string[];
};

export function parsePlatformAuditFilters(searchParams: PlatformAuditSearchParams): AuditReviewFilters {
  const action = firstValue(searchParams.action);
  const actorUserId = firstValue(searchParams.actor);
  const query = firstValue(searchParams.q);

  return {
    ...(action && actions.has(action as AssistantAuditEventDraft["action"])
      ? { action: action as AssistantAuditEventDraft["action"] }
      : {}),
    ...(actorUserId?.trim() ? { actorUserId: actorUserId.trim() } : {}),
    ...(query?.trim() ? { query: query.trim() } : {})
  };
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
