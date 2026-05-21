import type {
  AssistantActionWriteDraft,
  AssistantMessageWriteDraft,
  AssistantPersistenceDraft,
  AssistantThreadWriteDraft
} from "./persistence";
import {
  createAssistantActionExecutionAuditEvent,
  createAssistantAuditEvents,
  type AssistantAuditEventDraft
} from "./audit-log";
import type { FeedbackItemDraft } from "./feedback-item";
import { transitionFeedbackStatus, type FeedbackTriageEvent } from "./feedback-triage";
import { filterPlatformFeedback, type PlatformFeedbackFilters } from "./platform-inbox";
import type { AssistantRepositoryContract } from "./repository-contract";

export type AssistantMemoryRepository = {
  save(draft: AssistantPersistenceDraft): void;
  listThreads(workspaceId: string): AssistantThreadWriteDraft[];
  listMessages(threadId: string): AssistantMessageWriteDraft[];
  listFeedback(workspaceId: string, filters?: PlatformFeedbackFilters): FeedbackItemDraft[];
  updateFeedbackStatus(workspaceId: string, sourceMessageId: string, event: FeedbackTriageEvent): FeedbackItemDraft | null;
  listActions(workspaceId: string): AssistantActionWriteDraft[];
  updateActionExecutionResult(
    workspaceId: string,
    messageId: string,
    update: Pick<AssistantActionWriteDraft, "status" | "result">
  ): AssistantActionWriteDraft | null;
  listAuditEvents(workspaceId: string): AssistantAuditEventDraft[];
  clear(): void;
};

export function createAssistantMemoryRepository(): AssistantMemoryRepository {
  const threads = new Map<string, AssistantThreadWriteDraft>();
  const messages: AssistantMessageWriteDraft[] = [];
  const feedback: FeedbackItemDraft[] = [];
  const actions: AssistantActionWriteDraft[] = [];
  const auditEvents: AssistantAuditEventDraft[] = [];

  const repository: AssistantMemoryRepository = {
    save(draft) {
      threads.set(draft.thread.id, draft.thread);
      messages.push(draft.message);

      if (draft.feedback) {
        feedback.push(draft.feedback);
      }

      if (draft.action) {
        actions.push(draft.action);
      }

      auditEvents.push(...createAssistantAuditEvents(draft));
    },
    listThreads(workspaceId) {
      return Array.from(threads.values()).filter((thread) => thread.workspaceId === workspaceId);
    },
    listMessages(threadId) {
      return messages.filter((message) => message.threadId === threadId);
    },
    listFeedback(workspaceId, filters = {}) {
      return filterPlatformFeedback(
        feedback.filter((item) => item.workspaceId === workspaceId),
        filters
      );
    },
    updateFeedbackStatus(workspaceId, sourceMessageId, event) {
      const item = feedback.find((entry) => entry.workspaceId === workspaceId && entry.sourceMessageId === sourceMessageId);

      if (!item) {
        return null;
      }

      item.status = transitionFeedbackStatus(item.status, event);
      return item;
    },
    listActions(workspaceId) {
      return actions.filter((action) => action.workspaceId === workspaceId);
    },
    updateActionExecutionResult(workspaceId, messageId, update) {
      const action = actions.find((entry) => entry.workspaceId === workspaceId && entry.messageId === messageId);

      if (!action) {
        return null;
      }

      action.status = update.status;
      action.result = update.result;
      if (update.status === "executed" || update.status === "failed") {
        auditEvents.push(
          createAssistantActionExecutionAuditEvent({
            workspaceId: action.workspaceId,
            actorUserId: action.requestedByUserId,
            threadId: action.threadId,
            messageId: action.messageId,
            actionType: action.actionType,
            status: update.status,
            result: update.result
          })
        );
      }
      return action;
    },
    listAuditEvents(workspaceId) {
      return auditEvents.filter((event) => event.workspaceId === workspaceId);
    },
    clear() {
      threads.clear();
      messages.length = 0;
      feedback.length = 0;
      actions.length = 0;
      auditEvents.length = 0;
    }
  };

  return repository satisfies AssistantRepositoryContract;
}
