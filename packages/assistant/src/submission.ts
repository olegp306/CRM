import { createActionPreview, type ActionPreview } from "./action-preview";
import { createAssistantChannelResponse } from "./channel-engine";
import { advanceActionConfirmation, type ActionConfirmationStatus } from "./confirmation-state";
import type { AssistantContext } from "./context";
import { createFeedbackItemFromMessage, type FeedbackItemDraft } from "./feedback-item";
import { getPermissionBlockedResponse, type PermissionBlockedResponse } from "./permission-blocked";
import {
  createAssistantMessageDraft,
  createAssistantThreadDraft,
  type AssistantMessageDraft,
  type AssistantThreadDraft
} from "./thread-message";

export type AssistantSubmissionInput = {
  context: AssistantContext;
  content: string;
  threadId: string;
  messageId: string;
};

export type AssistantSubmissionResult = {
  thread: AssistantThreadDraft;
  message: AssistantMessageDraft;
  response: string;
  feedback: FeedbackItemDraft | null;
  actionPreview: ActionPreview | null;
  confirmationStatus: ActionConfirmationStatus | null;
  permissionBlocked: PermissionBlockedResponse | null;
};

export function createAssistantSubmissionResult({
  context,
  content,
  threadId,
  messageId
}: AssistantSubmissionInput): AssistantSubmissionResult {
  const trimmedContent = content.trim();
  const thread = createAssistantThreadDraft({
    context,
    title: trimmedContent
  });
  const message = createAssistantMessageDraft({
    threadId,
    userId: context.userId,
    role: "user",
    content: trimmedContent,
    context
  });

  if (message.intent === "crm_action") {
    const actionPreview = createCrmActionPreview(trimmedContent, context);

    if (!canUseAssistantActionMode(context.role)) {
      const permissionBlocked = getPermissionBlockedResponse({
        role: context.role,
        actionType: actionPreview.actionType,
        moduleContext: context.module
      });
      const feedback = createFeedbackItemFromMessage({
        workspaceId: context.workspaceId,
        sourceThreadId: threadId,
        sourceMessageId: messageId,
        intent: permissionBlocked.feedbackType,
        moduleContext: context.module,
        role: context.role
      });

      return {
        thread,
        message,
        response: permissionBlocked.message,
        feedback,
        actionPreview: null,
        confirmationStatus: "cancelled",
        permissionBlocked
      };
    }

    return {
      thread,
      message,
      response: `I prepared ${getActionPreviewLabel(actionPreview.actionType)} preview. Confirm before I execute it.`,
      feedback: null,
      actionPreview,
      confirmationStatus: advanceActionConfirmation("draft", "preview"),
      permissionBlocked: null
    };
  }

  const channelResponse = createAssistantChannelResponse({
    channel: "web",
    threadId,
    messageId,
    content: trimmedContent,
    receivedAt: new Date().toISOString(),
    context,
    attachments: []
  });

  let feedback: FeedbackItemDraft | null = null;

  if (channelResponse.shouldPersistFeedback) {
    const feedbackType = channelResponse.feedbackType;

    if (!feedbackType) {
      throw new Error("Assistant channel response requested feedback persistence without a feedback type.");
    }

    feedback = createFeedbackItemFromMessage({
      workspaceId: context.workspaceId,
      sourceThreadId: threadId,
      sourceMessageId: messageId,
      intent: feedbackType,
      moduleContext: context.module,
      role: context.role
    });
  }

  return {
    thread,
    message,
    response: channelResponse.text,
    feedback,
    actionPreview: null,
    confirmationStatus: null,
    permissionBlocked: null
  };
}

function canUseAssistantActionMode(role: string): boolean {
  return role === "owner" || role === "admin";
}

function createCrmActionPreview(content: string, context?: AssistantContext): ActionPreview {
  if (isKpGenerationRequest(content)) {
    return createActionPreview({
      actionType: "generate_kp",
      summary: "Generate KP document from assistant request",
      changes: [
        { field: "document.type", from: null, to: "kp" },
        { field: "document.selectedRecordIds", from: null, to: context?.selectedRecordIds ?? [] },
        { field: "document.sourceText", from: null, to: content }
      ]
    });
  }

  if (isMarkKpSentRequest(content)) {
    return createActionPreview({
      actionType: "mark_kp_sent",
      summary: "Mark KP as sent from assistant request",
      changes: [
        { field: "lead.selectedRecordIds", from: null, to: context?.selectedRecordIds ?? [] },
        { field: "lead.sourceText", from: null, to: content }
      ]
    });
  }

  if (isProjectTaskUpdateRequest(content)) {
    return createActionPreview({
      actionType: "update_project_task",
      summary: "Update project task from assistant request",
      changes: [
        { field: "project.selectedRecordIds", from: null, to: context?.selectedRecordIds ?? [] },
        { field: "task.sourceText", from: null, to: content }
      ]
    });
  }

  if (isScheduleFollowupRequest(content)) {
    return createActionPreview({
      actionType: "schedule_followup",
      summary: "Schedule follow-up from assistant request",
      changes: [{ field: "followup.sourceText", from: null, to: content }]
    });
  }

  return createActionPreview({
    actionType: "create_lead",
    summary: "Create lead from assistant request",
    changes: [{ field: "lead.sourceText", from: null, to: content }]
  });
}

function isProjectTaskUpdateRequest(content: string): boolean {
  return /\b(project|task|tasks|permit|package)\b/i.test(content) && /\b(update|done|complete|close|finish)\b/i.test(content);
}

function isKpGenerationRequest(content: string): boolean {
  return /\b(generate|create|prepare|draft)\b/i.test(content) && /\b(kp|offer|proposal|document)\b/i.test(content);
}

function isMarkKpSentRequest(content: string): boolean {
  return /\b(mark|set|record)\b/i.test(content) && /\b(kp|offer|proposal)\b/i.test(content) && /\b(sent|sended|отправ)/i.test(content);
}

function isScheduleFollowupRequest(content: string): boolean {
  return /\b(follow[-\s]?up|remind|reminder|schedule)\b/i.test(content);
}

function getActionPreviewLabel(actionType: string): string {
  if (actionType === "create_lead") {
    return "a create lead";
  }

  if (actionType === "schedule_followup") {
    return "a schedule follow-up";
  }

  if (actionType === "update_project_task") {
    return "an update project task";
  }

  if (actionType === "generate_kp") {
    return "a generate KP";
  }

  if (actionType === "mark_kp_sent") {
    return "a mark KP sent";
  }

  return actionType.replace(/_/g, " ");
}
