import type { ActionPreview } from "./action-preview";
import type { ActionConfirmationStatus } from "./confirmation-state";
import type { AssistantContext } from "./context";
import type { FeedbackItemDraft } from "./feedback-item";
import type { AssistantIntent } from "./classify-intent";
import type { AssistantSubmissionResult } from "./submission";
import type { AssistantChannelEvent } from "./channel-event";

export type AssistantPersistenceIds = {
  threadId: string;
  messageId: string;
};

export type AssistantThreadWriteDraft = {
  id: string;
  workspaceId: string;
  createdByUserId: string;
  title?: string;
};

export type AssistantMessageWriteDraft = {
  id: string;
  threadId: string;
  userId?: string;
  role: "user" | "assistant" | "system";
  content: string;
  context: AssistantContext;
  intent: AssistantIntent;
};

export type AssistantActionWriteDraft = {
  workspaceId: string;
  threadId: string;
  messageId: string;
  actionType: string;
  preview: ActionPreview;
  status: ActionConfirmationStatus;
  requestedByUserId: string;
  result?: Record<string, unknown>;
};

export type AssistantPersistenceDraft = {
  thread: AssistantThreadWriteDraft;
  message: AssistantMessageWriteDraft;
  feedback: FeedbackItemDraft | null;
  action: AssistantActionWriteDraft | null;
  channelEvents: AssistantChannelEvent[];
};

export function createAssistantPersistenceDraft(
  result: AssistantSubmissionResult,
  ids: AssistantPersistenceIds,
  options: { channelEvents?: AssistantChannelEvent[] } = {}
): AssistantPersistenceDraft {
  return {
    thread: {
      id: ids.threadId,
      workspaceId: result.thread.workspaceId,
      createdByUserId: result.thread.createdByUserId,
      ...(result.thread.title ? { title: result.thread.title } : {})
    },
    message: {
      id: ids.messageId,
      threadId: ids.threadId,
      userId: result.message.userId,
      role: result.message.role,
      content: result.message.content,
      context: result.message.context,
      intent: result.message.intent
    },
    feedback: result.feedback,
    action: result.actionPreview
      ? {
          workspaceId: result.message.context.workspaceId,
          threadId: ids.threadId,
          messageId: ids.messageId,
          actionType: result.actionPreview.actionType,
          preview: result.actionPreview,
          status: result.confirmationStatus ?? "draft",
          requestedByUserId: result.message.context.userId
        }
      : null,
    channelEvents: options.channelEvents ?? []
  };
}
