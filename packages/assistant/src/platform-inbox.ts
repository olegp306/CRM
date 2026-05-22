import type { FeedbackItemDraft, FeedbackItemIntent, FeedbackItemStatus } from "./feedback-item";
import type { FeedbackTriageEvent } from "./feedback-triage";
import type { AssistantActionWriteDraft, AssistantMessageWriteDraft } from "./persistence";

export type PlatformFeedbackFilters = {
  status?: FeedbackItemStatus;
  type?: FeedbackItemIntent;
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
  originalMessage?: string;
  taskTitle?: string;
  taskSummary?: string;
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
  actions,
  messages = []
}: {
  feedback: FeedbackItemDraft[];
  actions: AssistantActionWriteDraft[];
  messages?: AssistantMessageWriteDraft[];
}): PlatformInboxSummary {
  const messagesById = new Map(messages.map((message) => [message.id, message]));
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
        label: createFeedbackTaskTitle(messagesById.get(item.sourceMessageId)?.content, item.type),
        moduleContext: item.moduleContext ?? "other",
        status: item.status,
        sourceThreadId: item.sourceThreadId,
        sourceMessageId: item.sourceMessageId,
        appVersion: item.appVersion,
        originalMessage: messagesById.get(item.sourceMessageId)?.content,
        taskTitle: createFeedbackTaskTitle(messagesById.get(item.sourceMessageId)?.content, item.type),
        taskSummary: createFeedbackTaskSummary(messagesById.get(item.sourceMessageId)?.content, item.type)
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

export function createFeedbackTaskTitle(content: string | undefined, type: FeedbackItemIntent): string {
  const source = extractClientSource(content);
  const firstLine = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstLine) {
    return type.replace(/_/g, " ");
  }

  const cleaned = firstLine
    .replace(/^client answers?:\s*/i, "")
    .replace(/^feature request(?: from onboarding conversation)?:\s*/i, "")
    .trim();
  const title = cleaned.length > 76 ? `${cleaned.slice(0, 73).trim()}...` : cleaned;

  return title || type.replace(/_/g, " ");
}

export function createFeedbackTaskSummary(content: string | undefined, type: FeedbackItemIntent): string {
  const source = extractClientSource(content);

  if (!source) {
    return `Review ${type.replace(/_/g, " ")} from assistant.`;
  }

  if (/переведи|translate|на русский|по-русски/i.test(source)) {
    return "User asked the assistant to translate or switch language. Review whether language handling should be improved.";
  }

  return source.length > 280 ? `${source.slice(0, 277).trim()}...` : source;
}

function extractClientSource(content: string | undefined): string {
  const source = content?.trim() ?? "";
  const clientAnswers = source.match(/Client answers:\s*([\s\S]+)/i);

  return (clientAnswers?.[1] ?? source).trim();
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
