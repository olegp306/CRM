import type { AssistantPersistenceDraft } from "./persistence";
import type { ActionConfirmationStatus } from "./confirmation-state";

export type AssistantAuditEventDraft = {
  workspaceId: string;
  actorUserId?: string;
  action:
    | "assistant.message.submitted"
    | "assistant.action.preview_created"
    | "assistant.action.executed"
    | "assistant.channel.event"
    | "platform.release.planned";
  targetType: "AssistantMessage" | "AssistantAction" | "AssistantChannelEvent" | "PlatformRelease";
  targetId: string;
  metadata: Record<string, unknown>;
};

export type CreateAssistantActionExecutionAuditEventInput = {
  workspaceId: string;
  actorUserId?: string;
  threadId: string;
  messageId: string;
  actionType: string;
  status: Extract<ActionConfirmationStatus, "executed" | "failed">;
  result?: Record<string, unknown>;
};

export type CreatePlatformReleasePlanningAuditEventInput = {
  workspaceId: string;
  actorUserId?: string;
  appVersion: string;
  plannedCount: number;
  skippedCount: number;
};

export function createAssistantAuditEvents(draft: AssistantPersistenceDraft): AssistantAuditEventDraft[] {
  const events: AssistantAuditEventDraft[] = [
    {
      workspaceId: draft.thread.workspaceId,
      actorUserId: draft.message.userId,
      action: "assistant.message.submitted",
      targetType: "AssistantMessage",
      targetId: draft.message.id,
      metadata: {
        intent: draft.message.intent,
        moduleContext: draft.message.context.module,
        threadId: draft.thread.id
      }
    }
  ];

  if (draft.action) {
    events.push({
      workspaceId: draft.action.workspaceId,
      actorUserId: draft.action.requestedByUserId,
      action: "assistant.action.preview_created",
      targetType: "AssistantAction",
      targetId: draft.action.messageId,
      metadata: {
        actionType: draft.action.actionType,
        status: draft.action.status,
        threadId: draft.action.threadId
      }
    });
  }

  for (const event of draft.channelEvents) {
    events.push({
      workspaceId: draft.thread.workspaceId,
      actorUserId: draft.message.userId,
      action: "assistant.channel.event",
      targetType: "AssistantChannelEvent",
      targetId: createChannelEventTargetId(event),
      metadata: event
    });
  }

  return events;
}

function createChannelEventTargetId(event: AssistantPersistenceDraft["channelEvents"][number]): string {
  const leadOrMessageId = "leadId" in event && event.leadId ? event.leadId : "messageId" in event ? event.messageId : "none";
  return `${event.channel}:${event.type}:${event.threadId}:${leadOrMessageId}`;
}

export function createAssistantActionExecutionAuditEvent({
  workspaceId,
  actorUserId,
  threadId,
  messageId,
  actionType,
  status,
  result
}: CreateAssistantActionExecutionAuditEventInput): AssistantAuditEventDraft {
  return {
    workspaceId,
    actorUserId,
    action: "assistant.action.executed",
    targetType: "AssistantAction",
    targetId: messageId,
    metadata: {
      actionType,
      status,
      threadId,
      ...(result ? { result } : {})
    }
  };
}

export function createPlatformReleasePlanningAuditEvent({
  workspaceId,
  actorUserId,
  appVersion,
  plannedCount,
  skippedCount
}: CreatePlatformReleasePlanningAuditEventInput): AssistantAuditEventDraft {
  return {
    workspaceId,
    actorUserId,
    action: "platform.release.planned",
    targetType: "PlatformRelease",
    targetId: appVersion,
    metadata: {
      appVersion,
      plannedCount,
      skippedCount
    }
  };
}
