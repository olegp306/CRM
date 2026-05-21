import { createAssistantAuditEvents, type AssistantPersistenceDraft } from "@app/assistant";

export type AssistantPrismaWritePlan = {
  threadUpsert: {
    where: { id: string };
    create: {
      id: string;
      workspaceId: string;
      createdByUserId: string;
      title?: string;
    };
    update: {
      title?: string;
    };
  };
  messageCreate: {
    id: string;
    threadId: string;
    userId?: string;
    role: string;
    content: string;
    context: unknown;
    intent: string;
  };
  feedbackCreate: {
    workspaceId: string;
    sourceThreadId: string;
    sourceMessageId: string;
    type: string;
    status: string;
    priority: string;
    moduleContext?: string;
    appVersion: string;
  } | null;
  actionCreate: {
    workspaceId: string;
    threadId: string;
    messageId: string;
    actionType: string;
    preview: unknown;
    status: string;
    requestedByUserId: string;
  } | null;
  auditCreateManyData: Array<{
    workspaceId: string;
    actorUserId?: string;
    action: string;
    targetType: string;
    targetId: string;
    metadata: unknown;
  }>;
};

export function createAssistantPrismaWritePlan(draft: AssistantPersistenceDraft): AssistantPrismaWritePlan {
  return {
    threadUpsert: {
      where: { id: draft.thread.id },
      create: {
        id: draft.thread.id,
        workspaceId: draft.thread.workspaceId,
        createdByUserId: draft.thread.createdByUserId,
        ...(draft.thread.title ? { title: draft.thread.title } : {})
      },
      update: {
        ...(draft.thread.title ? { title: draft.thread.title } : {})
      }
    },
    messageCreate: {
      id: draft.message.id,
      threadId: draft.message.threadId,
      userId: draft.message.userId,
      role: draft.message.role,
      content: draft.message.content,
      context: draft.message.context,
      intent: draft.message.intent
    },
    feedbackCreate: draft.feedback
      ? {
          workspaceId: draft.feedback.workspaceId,
          sourceThreadId: draft.feedback.sourceThreadId,
          sourceMessageId: draft.feedback.sourceMessageId,
          type: draft.feedback.type,
          status: draft.feedback.status,
          priority: draft.feedback.priority,
          moduleContext: draft.feedback.moduleContext,
          appVersion: draft.feedback.appVersion
        }
      : null,
    actionCreate: draft.action
      ? {
          workspaceId: draft.action.workspaceId,
          threadId: draft.action.threadId,
          messageId: draft.action.messageId,
          actionType: draft.action.actionType,
          preview: draft.action.preview,
          status: draft.action.status,
          requestedByUserId: draft.action.requestedByUserId
        }
      : null,
    auditCreateManyData: createAssistantAuditEvents(draft).map((event) => ({
      workspaceId: event.workspaceId,
      actorUserId: event.actorUserId,
      action: event.action,
      targetType: event.targetType,
      targetId: event.targetId,
      metadata: event.metadata
    }))
  };
}
