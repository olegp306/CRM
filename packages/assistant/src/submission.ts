import { createActionPreview, type ActionPreview } from "./action-preview";
import { createAssistantChannelResponse, isLeadSourceMaterial } from "./channel-engine";
import type {
  AssistantChannelAttachment,
  AssistantChannelMessage,
  AssistantChannelResponse,
  AssistantChannelResponseButton
} from "./channel-message";
import { advanceActionConfirmation, type ActionConfirmationStatus } from "./confirmation-state";
import type { AssistantContext } from "./context";
import { createFeedbackItemFromMessage, type FeedbackItemDraft } from "./feedback-item";
import type { LeadChatSnapshot } from "./lead-chat-orchestrator";
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
  attachments?: AssistantChannelAttachment[];
  lead?: LeadChatSnapshot | null;
};

export type AssistantSubmissionResult = {
  thread: AssistantThreadDraft;
  message: AssistantMessageDraft;
  response: string;
  feedback: FeedbackItemDraft | null;
  actionPreview: ActionPreview | null;
  responseButtons: AssistantChannelResponseButton[];
  confirmationStatus: ActionConfirmationStatus | null;
  permissionBlocked: PermissionBlockedResponse | null;
};

export function createAssistantSubmissionResult({
  context,
  content,
  threadId,
  messageId,
  attachments,
  lead
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
  const channelMessage: AssistantChannelMessage = {
    channel: "web",
    threadId,
    messageId,
    content: trimmedContent,
    receivedAt: new Date().toISOString(),
    context,
    attachments: attachments ?? []
  };

  if (message.intent === "crm_action") {
    const actionPreview = createCrmActionPreview(trimmedContent, context);

    if (actionPreview.actionType === "create_lead" && isLeadSourceMaterial(channelMessage)) {
      const channelResponse = createAssistantChannelResponse(channelMessage, { lead });

      return createAssistantSubmissionResultFromChannelResponse({
        thread,
        message,
        channelResponse,
        context,
        threadId,
        messageId,
        attachments: attachments ?? []
      });
    }

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
        responseButtons: [],
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
        responseButtons: createConfirmationResponseButtons(),
        confirmationStatus: advanceActionConfirmation("draft", "preview"),
        permissionBlocked: null
      };
  }

  const channelResponse = createAssistantChannelResponse(channelMessage, { lead });

  return createAssistantSubmissionResultFromChannelResponse({
    thread,
    message,
    channelResponse,
    context,
    threadId,
    messageId,
    attachments: attachments ?? []
  });
}

export function createAssistantSubmissionResultFromChannelResponse({
  thread,
  message,
  channelResponse,
  context,
  threadId,
  messageId,
  attachments = []
}: {
  thread: AssistantThreadDraft;
  message: AssistantMessageDraft;
  channelResponse: AssistantChannelResponse;
  context: AssistantContext;
  threadId: string;
  messageId: string;
  attachments?: AssistantChannelAttachment[];
}): AssistantSubmissionResult {
  let feedback: FeedbackItemDraft | null = null;
  const actionPreview = canUseAssistantActionMode(context.role)
    ? createChannelActionPreview(channelResponse, message.content, attachments)
    : null;

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
    actionPreview,
    responseButtons: channelResponse.buttons,
    confirmationStatus: actionPreview ? advanceActionConfirmation("draft", "preview") : null,
    permissionBlocked: null
  };
}

function createChannelActionPreview(
  channelResponse: AssistantChannelResponse,
  sourceText: string,
  attachments: AssistantChannelAttachment[]
): ActionPreview | null {
  const leadActionButton = channelResponse.buttons.find(
    (button) => button.action === "mark_kp_sent" || button.action === "undo_kp_sent"
  );

  if (leadActionButton?.action === "mark_kp_sent" || leadActionButton?.action === "undo_kp_sent") {
    const leadId = channelResponse.normalizedActions?.includes(leadActionButton.action)
      ? extractLeadIdFromButtons(channelResponse.buttons)
      : null;

    if (leadId) {
      return createActionPreview({
        actionType: leadActionButton.action,
        summary: leadActionButton.action === "undo_kp_sent" ? "Undo KP sent from selected lead" : "Mark KP sent from selected lead",
        changes: [
          { field: "lead.selectedRecordIds", from: null, to: [leadId] },
          { field: "lead.sourceText", from: null, to: sourceText }
        ]
      });
    }
  }

  const hasConfirmButton = channelResponse.buttons.some((button) => button.action === "confirm");

  if (channelResponse.intent !== "lead_intake" || !hasConfirmButton) {
    return null;
  }

  return createActionPreview({
    actionType: "create_lead",
    summary: "Create lead from assistant source material",
    changes: [{ field: "lead.sourceText", from: null, to: appendAttachmentSummary(sourceText, attachments) }]
  });
}

function extractLeadIdFromButtons(buttons: AssistantChannelResponseButton[]): string | null {
  const crmUrl = buttons.find((button) => button.action === "open_crm" || button.label === "CRM")?.url;
  const leadId = /[?&]leadId=([^&]+)/.exec(crmUrl ?? "")?.[1];
  return leadId ? decodeURIComponent(leadId) : null;
}

function appendAttachmentSummary(sourceText: string, attachments: AssistantChannelAttachment[]): string {
  if (attachments.length === 0) {
    return sourceText;
  }

  return [
    sourceText,
    ...attachments.map((attachment, index) => {
      const kind = attachment.kind.toUpperCase();
      return `Web attachment ${index + 1}: ${kind} (${attachment.fileName || attachment.id})`;
    })
  ].join("\n");
}

function canUseAssistantActionMode(role: string): boolean {
  return role === "owner" || role === "admin";
}

function createConfirmationResponseButtons(): AssistantChannelResponseButton[] {
  return [
    { label: "Confirm", action: "confirm" },
    { label: "Cancel", action: "cancel" }
  ];
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
    const actionType = isUndoKpSentRequest(content) ? "undo_kp_sent" : "mark_kp_sent";

    return createActionPreview({
      actionType,
      summary: actionType === "undo_kp_sent" ? "Undo KP sent from assistant request" : "Mark KP as sent from assistant request",
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
  return (
    (/\b(generate|create|prepare|draft)\b/i.test(content) && /\b(kp|offer|proposal|document)\b/i.test(content)) ||
    /(сгенер|созда|подготов|сделай).{0,32}(кп|коммерческ\w*\s+предложен\w*)/i.test(content)
  );
}

function isMarkKpSentRequest(content: string): boolean {
  return (
    ((/\b(mark|set|record)\b/i.test(content) || isUndoKpSentRequest(content)) &&
      /\b(kp|offer|proposal)\b/i.test(content) &&
      /\b(sent|sended|отправ)/i.test(content)) ||
    /(кп|коммерческ\w*\s+предложен\w*).{0,32}(отправ|выслал|выслали)/i.test(content) ||
    /(отправ|выслал|выслали).{0,32}(кп|коммерческ\w*\s+предложен\w*)/i.test(content)
  );
}

function isUndoKpSentRequest(content: string): boolean {
  return (
    (/\b(undo|revert|cancel|clear|remove)\b/i.test(content) && /\b(kp|offer|proposal)\b/i.test(content)) ||
    /(отмени|откат|верни|убери).{0,32}(кп|коммерческ\w*\s+предложен\w*|отправ)/i.test(content)
  );
}

function isScheduleFollowupRequest(content: string): boolean {
  return (
    /\b(follow[-\s]?up|remind|reminder|schedule)\b/i.test(content) ||
    /(напомни|напомин|запланируй|поставь).{0,48}(лид|кп|follow-up|фоллоу|завтра|недел|день)/i.test(content)
  );
}

function getActionPreviewLabel(actionType: string): string {
  if (actionType === "create_lead") {
    return "a create lead";
  }

  if (actionType === "schedule_followup") {
    return "a schedule follow-up";
  }

  if (actionType === "update_project_task") {
    return "a project task update";
  }

  if (actionType === "generate_kp") {
    return "a KP generation";
  }

  if (actionType === "mark_kp_sent") {
    return "a KP sent update";
  }

  if (actionType === "undo_kp_sent") {
    return "a KP sent undo";
  }

  return actionType.replace(/_/g, " ");
}
