import { classifyIntent } from "./classify-intent";
import { createCapabilityResponse } from "./capability-registry";
import type { AssistantChannelMessage, AssistantChannelResponse, AssistantChannelResponseButton } from "./channel-message";
import { routeCrmOrchestratorRequest, type CrmOrchestratorDecision } from "./crm-orchestrator-agent";
import {
  createLeadChatOrchestratorResponse,
  type LeadChatSnapshot,
  isLeadChatSourceMaterial
} from "./lead-chat-orchestrator";
import {
  createLeadInteractionNoteSummary,
  createLeadNaturalContextSummary,
  isLeadInteractionNoteCommand,
  isLeadNaturalContextNote
} from "./lead-interaction-note";
import { createReminderHistorySummary, createReminderUserResponse, isReminderRequest } from "./lead-reminder";

export function createAssistantChannelResponse(
  message: AssistantChannelMessage,
  options: { lead?: LeadChatSnapshot | null } = {}
): AssistantChannelResponse {
  const intent = classifyIntent(message.content);

  if (isHelpMessage(message.content, intent)) {
    return {
      intent: "help",
      shouldPersistFeedback: false,
      feedbackType: undefined,
      buttons: [],
      normalizedActions: [],
      text: createSharedCapabilityMessage(message.channel)
    };
  }

  if (message.channel !== "telegram") {
    const capabilityResponse = createCapabilityResponse(message);

    if (capabilityResponse) {
      return capabilityResponse;
    }

  }

  const reminderResponse = createLeadReminderResponse(message);
  if (reminderResponse) {
    return reminderResponse;
  }

  const noteNeedsLeadResponse = createLeadNoteNeedsLeadResponse(message);
  if (noteNeedsLeadResponse) {
    return noteNeedsLeadResponse;
  }

  const contextNoteResponse = createLeadNaturalContextNoteResponse(message);
  if (contextNoteResponse) {
    return contextNoteResponse;
  }

  const noteResponse = createLeadInteractionNoteResponse(message);
  if (noteResponse) {
    return noteResponse;
  }

  if (message.channel !== "telegram" && isPersistedFeedbackIntent(intent)) {
    return {
      intent,
      shouldPersistFeedback: true,
      feedbackType: intent,
      buttons: [],
      normalizedActions: [],
      text: "I saved this as product feedback for review."
    };
  }

  const telegramOrchestratorResponse = createTelegramCrmOrchestratorResponse(message);
  if (telegramOrchestratorResponse) {
    return telegramOrchestratorResponse;
  }

  const leadChatResponse = createLeadChatOrchestratorResponse({ message, lead: options.lead });
  if (options.lead && leadChatResponse) {
    return leadChatResponse;
  }

  if (leadChatResponse && (intent !== "support_request" || isExplicitLeadIntakeText(message.content))) {
    return leadChatResponse;
  }

  if (isPrioritySupportRequest(message.content, intent, Boolean(getReferencedLeadId(message)))) {
    const leadId = getReferencedLeadId(message);

    return {
      intent: "support_request",
      shouldPersistFeedback: false,
      feedbackType: undefined,
      buttons: createLeadCrmButtons(leadId),
      normalizedActions: leadId ? ["open_crm"] : [],
      text: createSupportResponseText(message.channel, leadId)
    };
  }

  if (intent === "support_request") {
    const leadId = getReferencedLeadId(message);

    return {
      intent,
      shouldPersistFeedback: false,
      feedbackType: undefined,
      buttons: createLeadCrmButtons(leadId),
      normalizedActions: leadId ? ["open_crm"] : [],
      text: createSupportResponseText(message.channel, leadId)
    };
  }

  if (leadChatResponse) {
    return leadChatResponse;
  }

  if (message.channel === "telegram") {
    return createTelegramLimitedCrmActionsResponse();
  }

  const responseIntent = intent === "permission_blocked" ? "other" : intent;

  return {
    intent: responseIntent,
    shouldPersistFeedback: false,
    feedbackType: undefined,
    buttons: [],
    normalizedActions: [],
    text: "I can help with CRM leads. Send client text, photos, PDFs, or ask about the selected lead."
  };
}

function createLeadInteractionNoteResponse(message: AssistantChannelMessage): AssistantChannelResponse | null {
  const leadId = getReferencedLeadId(message);
  if (!leadId || !isLeadInteractionNoteCommand(message.content)) {
    return null;
  }

  const summary = createLeadInteractionNoteSummary(message.content);

  return {
    intent: "business_process_note",
    shouldPersistFeedback: false,
    feedbackType: undefined,
    buttons: createLeadCrmButtons(leadId),
    normalizedActions: ["open_crm"],
    text: `Saved this note to lead ${leadId} history: ${summary}`
  };
}

function createLeadNoteNeedsLeadResponse(message: AssistantChannelMessage): AssistantChannelResponse | null {
  if (getReferencedLeadId(message)) {
    return null;
  }

  if (!isLeadInteractionNoteCommand(message.content) && !isLeadNaturalContextNote(message.content)) {
    return null;
  }

  return {
    intent: "crm_action",
    shouldPersistFeedback: false,
    feedbackType: undefined,
    buttons: [],
    normalizedActions: [],
    text: "Which lead should I save this note to? Reply to a lead card or include the lead number."
  };
}

function createTelegramCrmOrchestratorResponse(message: AssistantChannelMessage): AssistantChannelResponse | null {
  if (message.channel !== "telegram") {
    return null;
  }

  const decision = routeCrmOrchestratorRequest(message);

  if (decision.intent === "CLARIFICATION_REQUIRED") {
    return null;
  }

  if (decision.intent === "CREATE_LEAD") {
    return null;
  }

  if (decision.status === "need_clarification") {
    return {
      intent: "support_request",
      shouldPersistFeedback: false,
      feedbackType: undefined,
      buttons: [],
      normalizedActions: [],
      text: decision.message
    };
  }

  if (decision.intent === "UPDATE_LEAD") {
    return null;
  }

  if (decision.intent === "SEARCH_LEAD") {
    return {
      intent: "support_request",
      shouldPersistFeedback: false,
      feedbackType: undefined,
      buttons: [],
      normalizedActions: [],
      text: "Search is recognized. I will look for matching CRM leads."
    };
  }

  if (decision.intent === "CREATE_REMINDER") {
    return createTelegramLimitedCrmActionsResponse();
  }

  if (decision.intent === "SUPPORT_REQUEST") {
    const leadId = getReferencedLeadId(message);

    return {
      intent: "support_request",
      shouldPersistFeedback: false,
      feedbackType: undefined,
      buttons: createLeadCrmButtons(leadId),
      normalizedActions: leadId ? ["open_crm"] : [],
      text: createSupportResponseText(message.channel, leadId)
    };
  }

  return null;
}

function createTelegramLimitedCrmActionsResponse(): AssistantChannelResponse {
  return {
    intent: "support_request",
    shouldPersistFeedback: false,
    feedbackType: undefined,
    buttons: [],
    normalizedActions: [],
    text: [
      "Telegram actions are limited right now.",
      "For now I can only create a lead or update an existing lead.",
      "Reply to a lead card with new source material or missing fields."
    ].join("\n")
  };
}

export function createCrmOrchestratorRoutedButPausedResponse(decision: CrmOrchestratorDecision, detail: string): AssistantChannelResponse {
  return {
    intent: "support_request",
    shouldPersistFeedback: false,
    feedbackType: undefined,
    buttons: [],
    normalizedActions: [],
    text: `${detail}\nRoute: ${decision.action}.\nFor now I can create a lead or update an existing lead in Telegram.`
  };
}

function createSupportResponseText(channel: AssistantChannelMessage["channel"], leadId: string | null): string {
  if (channel === "telegram") {
    return leadId
      ? `I can help with lead ${leadId}. Right now in Telegram I create or update leads and can open this lead in CRM.`
      : "Right now in Telegram I create or update leads. Reply to a lead card or send client source material.";
  }

  return leadId
    ? `I can help with lead ${leadId}: KP documents, follow-ups, CRM status, and what is waiting next.`
    : "I can help with leads, KP documents, follow-ups, and CRM status. Ask me about a lead or send source material.";
}

function createLeadNaturalContextNoteResponse(message: AssistantChannelMessage): AssistantChannelResponse | null {
  const leadId = getReferencedLeadId(message);
  if (!leadId || !isLeadNaturalContextNote(message.content)) {
    return null;
  }

  const summary = createLeadNaturalContextSummary(message.content);

  return {
    intent: "business_process_note",
    shouldPersistFeedback: false,
    feedbackType: undefined,
    buttons: createLeadCrmButtons(leadId),
    normalizedActions: ["open_crm"],
    text: `Saved this client context to lead ${leadId} history: ${summary}`
  };
}

function createLeadReminderResponse(message: AssistantChannelMessage): AssistantChannelResponse | null {
  if (!isReminderRequest(message.content)) {
    return null;
  }

  const leadId = getReferencedLeadId(message);
  if (!leadId) {
    return {
      intent: "crm_action",
      shouldPersistFeedback: false,
      feedbackType: undefined,
      buttons: [],
      normalizedActions: [],
      text: "I can create a follow-up reminder, but I need a lead context first. Reply to a lead card or open a lead in CRM, then send the reminder again."
    };
  }

  return {
    intent: "business_process_note",
    shouldPersistFeedback: false,
    feedbackType: undefined,
    buttons: createLeadCrmButtons(leadId),
    normalizedActions: ["open_crm"],
    text: createReminderUserResponse(leadId, message.content, { now: new Date(message.receivedAt) })
  };
}

function isHelpMessage(content: string, intent: string): boolean {
  if (/^\/(?:start|help)\b/i.test(content.trim())) {
    return true;
  }

  return intent === "support_request" && /(who are you|what can you do|кто ты|что умеешь)/i.test(content);
}

function isPersistedFeedbackIntent(intent: string): intent is "feature_request" | "bug_report" | "ux_feedback" {
  return intent === "feature_request" || intent === "bug_report" || intent === "ux_feedback";
}

function isExplicitLeadIntakeText(content: string): boolean {
  return /\bsource material\b|\bclient request\b|\bcreate\s+(?:a\s+)?lead\b|\bcapture\s+(?:a\s+)?lead\b|\bregister\s+(?:a\s+)?lead\b|\bimport\s+(?:a\s+)?lead\b|\bextract\b.*\blead\b|заявк[аиу]\s+клиент|материал\s+для\s+лид|созда[йть]+\s+лид|добавь\s+лид|зарегистрируй\s+лид/i.test(
    content
  );
}

function isPrioritySupportRequest(content: string, intent: string, hasLeadContext = false): boolean {
  return (
    (intent === "support_request" || hasLeadContext) &&
    /\b(?:help|support|status|what(?:'s| is)\s+the\s+status|where\s+is|check|update)\b|помоги|статус|что дальше|проверь/i.test(
      content
    )
  );
}

function getReferencedLeadId(message: AssistantChannelMessage): string | null {
  const fromReply = message.replyTo?.leadId;
  if (fromReply) {
    return fromReply;
  }

  const fromText = /\bL-\d{4}-\d+\b/i.exec(message.content)?.[0]?.toUpperCase();

  if (fromText) {
    return fromText;
  }

  return message.context.selectedRecordIds?.find((id) => /^L-\d{4}-\d+$/i.test(id)) ?? null;
}

function createLeadCrmButtons(leadId: string | null): AssistantChannelResponseButton[] {
  return leadId ? [{ label: "CRM", url: `/leads?leadId=${encodeURIComponent(leadId)}` }] : [];
}

export function isLeadSourceMaterial(message: AssistantChannelMessage): boolean {
  return message.channel === "web" && isLeadChatSourceMaterial(message);
}

function createSharedCapabilityMessage(channel: "web" | "telegram"): string {
  const uploadHint =
    channel === "web"
      ? "In the web app, you can also attach files and photos here. On mobile, use your keyboard microphone for voice dictation."
      : "In Telegram, you can send text, photos, PDFs, voice messages, and audio files. Reply to a lead card to update that exact lead.";
  const capabilityText =
    channel === "telegram"
      ? "I can create and update leads. Right now in Telegram I only create leads and update existing leads; other CRM actions are paused while we unify the workflow."
      : "I can create and update leads, read source materials, track missing KP fields, prepare KP documents, mark KP as sent, and explain what is waiting next.";

  return [
    "Hi, I am Oleg's CRM assistant.",
    capabilityText,
    uploadHint,
    "I only save feature requests when the message is clearly product feedback."
  ].join("\n\n");
}
