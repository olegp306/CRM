import type { FeedbackItemDraft, FeedbackItemIntent, FeedbackItemStatus } from "./feedback-item";
import type { FeedbackTriageEvent } from "./feedback-triage";
import type { AssistantActionWriteDraft } from "./persistence";

export type PlatformFeedbackFilters = {
  status?: FeedbackItemStatus;
  type?: FeedbackItemIntent;
  appVersion?: string;
};

export type PlatformInboxRow = {
  id: string;
  kind: "feedback" | "action";
  label: string;
  moduleContext: string;
  status: string;
  sourceThreadId: string;
  sourceMessageId: string;
  appVersion: string;
};

export type PlatformInboxSummary = {
  feedbackCount: number;
  actionCount: number;
  openCount: number;
  feedbackByType: Record<string, number>;
  rows: PlatformInboxRow[];
};

export type PlatformFeedbackBulkUpdatePlan = {
  event: FeedbackTriageEvent;
  count: number;
  items: Array<{
    workspaceId: string;
    sourceMessageId: string;
  }>;
};

export function createPlatformInboxSummary({
  feedback,
  actions
}: {
  feedback: FeedbackItemDraft[];
  actions: AssistantActionWriteDraft[];
}): PlatformInboxSummary {
  const feedbackByType = feedback.reduce<Record<string, number>>((counts, item) => {
    counts[item.type] = (counts[item.type] ?? 0) + 1;
    return counts;
  }, {});

  return {
    feedbackCount: feedback.length,
    actionCount: actions.length,
    openCount: feedback.length + actions.length,
    feedbackByType,
    rows: [
      ...feedback.map((item) => ({
        id: `feedback-${item.sourceMessageId}`,
        kind: "feedback" as const,
        label: item.type,
        moduleContext: item.moduleContext ?? "other",
        status: item.status,
        sourceThreadId: item.sourceThreadId,
        sourceMessageId: item.sourceMessageId,
        appVersion: item.appVersion
      })),
      ...actions.map((action) => ({
        id: `action-${action.messageId}`,
        kind: "action" as const,
        label: action.actionType,
        moduleContext: "assistant",
        status: action.status,
        sourceThreadId: action.threadId,
        sourceMessageId: action.messageId,
        appVersion: "unknown"
      }))
    ]
  };
}

export function filterPlatformFeedback(
  feedback: FeedbackItemDraft[],
  filters: PlatformFeedbackFilters
): FeedbackItemDraft[] {
  return feedback.filter((item) => {
    if (filters.status && item.status !== filters.status) {
      return false;
    }

    if (filters.type && item.type !== filters.type) {
      return false;
    }

    if (filters.appVersion && item.appVersion !== filters.appVersion) {
      return false;
    }

    return true;
  });
}

export function createPlatformFeedbackCsv(feedback: FeedbackItemDraft[]): string {
  return [
    "sourceMessageId,type,status,moduleContext,role,appVersion",
    ...feedback.map((item) =>
      [item.sourceMessageId, item.type, item.status, item.moduleContext ?? "", item.role ?? "", item.appVersion]
        .map(escapeCsvCell)
        .join(",")
    )
  ].join("\n");
}

function escapeCsvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replaceAll("\"", "\"\"")}"` : value;
}

export function createPlatformFeedbackBulkUpdatePlan(
  feedback: FeedbackItemDraft[],
  event: FeedbackTriageEvent
): PlatformFeedbackBulkUpdatePlan {
  return {
    event,
    count: feedback.length,
    items: feedback.map((item) => ({
      workspaceId: item.workspaceId,
      sourceMessageId: item.sourceMessageId
    }))
  };
}
