import type { AssistantAuditEventDraft } from "./audit-log";

export type AuditReviewFilters = {
  action?: AssistantAuditEventDraft["action"];
  actorUserId?: string;
  query?: string;
};

export type AuditReviewSummary = {
  totalCount: number;
  actionCounts: Record<AssistantAuditEventDraft["action"], number>;
  actorCounts: Record<string, number>;
  executedActionCount: number;
};

export function filterAuditEvents(
  events: AssistantAuditEventDraft[],
  filters: AuditReviewFilters = {}
): AssistantAuditEventDraft[] {
  const query = filters.query?.trim().toLowerCase();

  return events.filter((event) => {
    if (filters.action && event.action !== filters.action) {
      return false;
    }

    if (filters.actorUserId && event.actorUserId !== filters.actorUserId) {
      return false;
    }

    if (query && !createAuditSearchText(event).includes(query)) {
      return false;
    }

    return true;
  });
}

export function createAuditReviewSummary(events: AssistantAuditEventDraft[]): AuditReviewSummary {
  const actionCounts = {
    "assistant.action.executed": 0,
    "assistant.action.preview_created": 0,
    "assistant.message.submitted": 0,
    "platform.release.planned": 0
  } satisfies Record<AssistantAuditEventDraft["action"], number>;
  const actorCounts: Record<string, number> = {};

  for (const event of events) {
    actionCounts[event.action] += 1;
    const actor = event.actorUserId ?? "system";
    actorCounts[actor] = (actorCounts[actor] ?? 0) + 1;
  }

  return {
    totalCount: events.length,
    actionCounts,
    actorCounts,
    executedActionCount: actionCounts["assistant.action.executed"]
  };
}

export function createAuditEventsCsv(events: AssistantAuditEventDraft[]): string {
  return [
    ["action", "targetType", "targetId", "actorUserId", "metadata"].join(","),
    ...events.map((event) =>
      [
        event.action,
        event.targetType,
        event.targetId,
        event.actorUserId ?? "system",
        JSON.stringify(event.metadata)
      ]
        .map(formatCsvCell)
        .join(",")
    )
  ].join("\n");
}

function createAuditSearchText(event: AssistantAuditEventDraft): string {
  return [
    event.action,
    event.targetType,
    event.targetId,
    event.actorUserId ?? "system",
    JSON.stringify(event.metadata)
  ]
    .join(" ")
    .toLowerCase();
}

function formatCsvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}
