import type { AssistantIntent } from "./classify-intent";

export type FeedbackItemIntent = Extract<
  AssistantIntent,
  "support_request" | "bug_report" | "feature_request" | "ux_feedback" | "permission_blocked"
>;

export type CreateFeedbackItemInput = {
  workspaceId: string;
  sourceThreadId: string;
  sourceMessageId: string;
  intent: AssistantIntent;
  moduleContext?: string;
  role?: string;
};

export type FeedbackItemDraft = {
  workspaceId: string;
  sourceThreadId: string;
  sourceMessageId: string;
  type: FeedbackItemIntent;
  status: FeedbackItemStatus;
  priority: "normal";
  moduleContext?: string;
  role?: string;
};

export type FeedbackItemStatus = "new" | "triaged" | "planned" | "transferred" | "declined" | "archived";

const feedbackIntents = new Set<AssistantIntent>([
  "support_request",
  "bug_report",
  "feature_request",
  "ux_feedback",
  "permission_blocked"
]);

export function shouldCreateFeedbackItem(intent: AssistantIntent): intent is FeedbackItemIntent {
  return feedbackIntents.has(intent);
}

export function createFeedbackItemFromMessage(input: CreateFeedbackItemInput): FeedbackItemDraft | null {
  if (!shouldCreateFeedbackItem(input.intent)) {
    return null;
  }

  return {
    workspaceId: input.workspaceId,
    sourceThreadId: input.sourceThreadId,
    sourceMessageId: input.sourceMessageId,
    type: input.intent,
    status: "new",
    priority: "normal",
    moduleContext: input.moduleContext,
    role: input.role
  };
}
