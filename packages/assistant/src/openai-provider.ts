import { createActionPreview, type ActionPreview, type AssistantActionType } from "./action-preview";
import { createAssistantChannelResponse, isLeadSourceMaterial } from "./channel-engine";
import type { AssistantChannelMessage, AssistantChannelResponse } from "./channel-message";
import { advanceActionConfirmation } from "./confirmation-state";
import type { AssistantContext } from "./context";
import { createFeedbackItemFromMessage, type FeedbackItemDraft } from "./feedback-item";
import { getPermissionBlockedResponse } from "./permission-blocked";
import type { AssistantSubmissionInput, AssistantSubmissionResult } from "./submission";
import { createAssistantMessageDraft, createAssistantThreadDraft, type AssistantMessageDraft, type AssistantThreadDraft } from "./thread-message";

export type OpenAIAssistantFetch = (url: string, init?: RequestInit) => Promise<Response>;

export type OpenAIAssistantConfig = {
  apiKey: string;
  model: string;
  endpoint?: string;
  fetch?: OpenAIAssistantFetch;
};

type OpenAIPlan = {
  response: string;
  action: null | {
    actionType: AssistantActionType;
    summary: string;
    sourceText?: string;
  };
};

type OpenAIAttachmentSummary = {
  id: string;
  kind: string;
  fileName: string;
  mimeType: string;
  hasBase64?: boolean;
  estimatedBytes?: number;
  textPreview?: string;
};

const defaultEndpoint = "https://api.openai.com/v1/chat/completions";
const allowedActionTypes = new Set<AssistantActionType>(["create_lead", "generate_kp", "schedule_followup", "update_project_task", "mark_kp_sent"]);
const maxAttachmentTextPreviewLength = 500;

export async function createOpenAIAssistantSubmissionResult(
  input: AssistantSubmissionInput,
  config: OpenAIAssistantConfig
): Promise<AssistantSubmissionResult> {
  const trimmedContent = input.content.trim();
  const thread = createAssistantThreadDraft({
    context: input.context,
    title: trimmedContent
  });
  const message = createAssistantMessageDraft({
    threadId: input.threadId,
    userId: input.context.userId,
    role: "user",
    content: trimmedContent,
    context: input.context
  });
  const channelMessage: AssistantChannelMessage = {
    channel: "web",
    threadId: input.threadId,
    messageId: input.messageId,
    content: trimmedContent,
    receivedAt: new Date().toISOString(),
    context: input.context,
    attachments: input.attachments ?? []
  };
  const plan = await requestOpenAIPlan(input, config);

  if (plan.action) {
    if (plan.action.actionType === "create_lead" && isLeadSourceMaterial(channelMessage)) {
      const channelResponse = createAssistantChannelResponse(channelMessage);

      return createResultFromChannelResponse({
        thread,
        message,
        channelResponse,
        context: input.context,
        threadId: input.threadId,
        messageId: input.messageId
      });
    }

    const actionPreview = createPreviewFromPlan(plan, trimmedContent, input.context);

    if (!canUseAssistantActionMode(input.context.role)) {
      const permissionBlocked = getPermissionBlockedResponse({
        role: input.context.role,
        actionType: actionPreview.actionType,
        moduleContext: input.context.module
      });
      const feedback = createFeedbackItemFromMessage({
        workspaceId: input.context.workspaceId,
        sourceThreadId: input.threadId,
        sourceMessageId: input.messageId,
        intent: permissionBlocked.feedbackType,
        moduleContext: input.context.module,
        role: input.context.role
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
      response: plan.response,
      feedback: null,
      actionPreview,
      confirmationStatus: advanceActionConfirmation("draft", "preview"),
      permissionBlocked: null
    };
  }

  const channelResponse = createAssistantChannelResponse(channelMessage);

  return createResultFromChannelResponse({
    thread,
    message,
    channelResponse,
    context: input.context,
    threadId: input.threadId,
    messageId: input.messageId
  });
}

function createResultFromChannelResponse({
  thread,
  message,
  channelResponse,
  context,
  threadId,
  messageId
}: {
  thread: AssistantThreadDraft;
  message: AssistantMessageDraft;
  channelResponse: AssistantChannelResponse;
  context: AssistantContext;
  threadId: string;
  messageId: string;
}): AssistantSubmissionResult {
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

async function requestOpenAIPlan(input: AssistantSubmissionInput, config: OpenAIAssistantConfig): Promise<OpenAIPlan> {
  const fetcher = config.fetch ?? fetch;
  const response = await fetcher(config.endpoint ?? defaultEndpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.2,
      max_tokens: 600,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: createSystemPrompt() },
        {
          role: "user",
          content: JSON.stringify({
            content: input.content,
            context: input.context,
            attachments: createOpenAIAttachmentSummaries(input.attachments ?? [])
          })
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI assistant request failed: ${response.status} ${response.statusText}`.trim());
  }

  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
  const content = payload.choices?.[0]?.message?.content;

  if (typeof content !== "string") {
    throw new Error("OpenAI assistant response did not include message content.");
  }

  return parseOpenAIPlan(content);
}

function createOpenAIAttachmentSummaries(attachments: NonNullable<AssistantSubmissionInput["attachments"]>): OpenAIAttachmentSummary[] {
  return attachments.map((attachment) => {
    const summary: OpenAIAttachmentSummary = {
      id: attachment.id,
      kind: attachment.kind,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType
    };

    if (!attachment.base64) {
      return summary;
    }

    summary.hasBase64 = true;
    summary.estimatedBytes = estimateBase64Bytes(attachment.base64);

    if (attachment.kind === "text") {
      const textPreview = decodeBase64TextPreview(attachment.base64);

      if (textPreview) {
        summary.textPreview = textPreview;
      }
    }

    return summary;
  });
}

function estimateBase64Bytes(base64: string): number {
  const paddingLength = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;

  return Math.max(0, Math.floor((base64.length * 3) / 4) - paddingLength);
}

function decodeBase64TextPreview(base64: string): string | null {
  try {
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const text = new TextDecoder().decode(bytes).trim();

    if (!text) {
      return null;
    }

    return text.slice(0, maxAttachmentTextPreviewLength);
  } catch {
    return null;
  }
}

function parseOpenAIPlan(content: string): OpenAIPlan {
  const parsed = JSON.parse(content) as Partial<OpenAIPlan>;

  if (typeof parsed.response !== "string" || parsed.response.trim() === "") {
    throw new Error("OpenAI assistant response is missing response text.");
  }

  if (parsed.action === null || parsed.action === undefined) {
    return { response: parsed.response, action: null };
  }

  if (
    typeof parsed.action !== "object" ||
    !allowedActionTypes.has(parsed.action.actionType) ||
    typeof parsed.action.summary !== "string" ||
    parsed.action.summary.trim() === ""
  ) {
    throw new Error("OpenAI assistant response included an invalid action.");
  }

  return {
    response: parsed.response,
    action: {
      actionType: parsed.action.actionType,
      summary: parsed.action.summary,
      sourceText: typeof parsed.action.sourceText === "string" ? parsed.action.sourceText : undefined
    }
  };
}

function createPreviewFromPlan(plan: OpenAIPlan, fallbackSourceText: string, context: AssistantContext): ActionPreview {
  if (!plan.action) {
    throw new Error("OpenAI plan does not include an action.");
  }

  const sourceText = plan.action.sourceText?.trim() || fallbackSourceText;

  if (plan.action.actionType === "generate_kp") {
    return createActionPreview({
      actionType: "generate_kp",
      summary: plan.action.summary,
      changes: [
        { field: "document.type", from: null, to: "kp" },
        { field: "document.selectedRecordIds", from: null, to: context.selectedRecordIds ?? [] },
        { field: "document.sourceText", from: null, to: sourceText }
      ]
    });
  }

  if (plan.action.actionType === "mark_kp_sent") {
    return createActionPreview({
      actionType: "mark_kp_sent",
      summary: plan.action.summary,
      changes: [
        { field: "lead.selectedRecordIds", from: null, to: context.selectedRecordIds ?? [] },
        { field: "lead.sourceText", from: null, to: sourceText }
      ]
    });
  }

  if (plan.action.actionType === "update_project_task") {
    return createActionPreview({
      actionType: "update_project_task",
      summary: plan.action.summary,
      changes: [
        { field: "project.selectedRecordIds", from: null, to: context.selectedRecordIds ?? [] },
        { field: "task.sourceText", from: null, to: sourceText }
      ]
    });
  }

  if (plan.action.actionType === "schedule_followup") {
    return createActionPreview({
      actionType: "schedule_followup",
      summary: plan.action.summary,
      changes: [{ field: "followup.sourceText", from: null, to: sourceText }]
    });
  }

  return createActionPreview({
    actionType: "create_lead",
    summary: plan.action.summary,
    changes: [{ field: "lead.sourceText", from: null, to: sourceText }]
  });
}

function canUseAssistantActionMode(role: string): boolean {
  return role === "owner" || role === "admin";
}

function createSystemPrompt(): string {
  return [
    "You are the CRM assistant runtime for an architecture studio SaaS.",
    "Return only valid JSON with shape: {\"response\": string, \"action\": null | {\"actionType\": \"create_lead\" | \"generate_kp\" | \"schedule_followup\" | \"update_project_task\" | \"mark_kp_sent\", \"summary\": string, \"sourceText\": string}}.",
    "Use create_lead when the user asks to add, create, capture, or register a lead/client opportunity.",
    "Use schedule_followup for reminders or follow-up scheduling.",
    "Use update_project_task for project/task status changes.",
    "Use generate_kp for KP, offer, proposal, or document generation.",
    "Use mark_kp_sent when the user says an existing KP, offer, or proposal was sent.",
    "If no operational action is needed, set action to null."
  ].join("\n");
}
