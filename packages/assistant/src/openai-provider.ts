import { createActionPreview, type ActionPreview, type AssistantActionType } from "./action-preview";
import { advanceActionConfirmation } from "./confirmation-state";
import type { AssistantContext } from "./context";
import { createFeedbackItemFromMessage, type FeedbackItemDraft } from "./feedback-item";
import { getPermissionBlockedResponse } from "./permission-blocked";
import type { AssistantSubmissionInput, AssistantSubmissionResult } from "./submission";
import { createAssistantMessageDraft, createAssistantThreadDraft } from "./thread-message";

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

const defaultEndpoint = "https://api.openai.com/v1/chat/completions";
const allowedActionTypes = new Set<AssistantActionType>(["create_lead", "generate_kp", "schedule_followup", "update_project_task", "mark_kp_sent"]);

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
  const plan = await requestOpenAIPlan(input, config);

  if (plan.action) {
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

  const feedback = createFeedbackItemFromMessage({
    workspaceId: input.context.workspaceId,
    sourceThreadId: input.threadId,
    sourceMessageId: input.messageId,
    intent: message.intent,
    moduleContext: input.context.module,
    role: input.context.role
  });

  return {
    thread,
    message,
    response: plan.response,
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
            context: input.context
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
