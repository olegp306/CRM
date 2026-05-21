import type { AssistantAuditEventDraft } from "./audit-log";
import type { FeedbackItemDraft } from "./feedback-item";
import type { FeedbackTriageEvent } from "./feedback-triage";
import type { PlatformFeedbackFilters } from "./platform-inbox";
import type {
  AssistantActionWriteDraft,
  AssistantMessageWriteDraft,
  AssistantPersistenceDraft,
  AssistantThreadWriteDraft
} from "./persistence";

export type AssistantRepositoryContract = {
  save(draft: AssistantPersistenceDraft): void | Promise<void>;
  listThreads(workspaceId: string): AssistantThreadWriteDraft[] | Promise<AssistantThreadWriteDraft[]>;
  listMessages(threadId: string): AssistantMessageWriteDraft[] | Promise<AssistantMessageWriteDraft[]>;
  listFeedback(workspaceId: string, filters?: PlatformFeedbackFilters): FeedbackItemDraft[] | Promise<FeedbackItemDraft[]>;
  updateFeedbackStatus(
    workspaceId: string,
    sourceMessageId: string,
    event: FeedbackTriageEvent
  ): FeedbackItemDraft | null | Promise<FeedbackItemDraft | null>;
  listActions(workspaceId: string): AssistantActionWriteDraft[] | Promise<AssistantActionWriteDraft[]>;
  updateActionExecutionResult(
    workspaceId: string,
    messageId: string,
    update: Pick<AssistantActionWriteDraft, "status" | "result">
  ): AssistantActionWriteDraft | null | Promise<AssistantActionWriteDraft | null>;
  saveAuditEvent(event: AssistantAuditEventDraft): void | Promise<void>;
  listAuditEvents(workspaceId: string): AssistantAuditEventDraft[] | Promise<AssistantAuditEventDraft[]>;
  clear(): void | Promise<void>;
};
