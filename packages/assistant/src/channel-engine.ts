import { classifyIntent } from "./classify-intent";
import { createCapabilityResponse } from "./capability-registry";
import type { AssistantChannelMessage, AssistantChannelResponse, AssistantChannelResponseButton } from "./channel-message";
import {
  createLeadChatOrchestratorResponse,
  isLeadChatSourceMaterial
} from "./lead-chat-orchestrator";

export function createAssistantChannelResponse(message: AssistantChannelMessage): AssistantChannelResponse {
  const intent = classifyIntent(message.content);
  const capabilityResponse = createCapabilityResponse(message);

  if (capabilityResponse) {
    return capabilityResponse;
  }

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

  if (isPersistedFeedbackIntent(intent)) {
    return {
      intent,
      shouldPersistFeedback: true,
      feedbackType: intent,
      buttons: [],
      normalizedActions: [],
      text: "I saved this as product feedback for review."
    };
  }

  const leadChatResponse = createLeadChatOrchestratorResponse({ message });
  if (leadChatResponse && (intent !== "support_request" || isExplicitLeadIntakeText(message.content))) {
    return leadChatResponse;
  }

  if (isPrioritySupportRequest(message.content, intent)) {
    const leadId = getReferencedLeadId(message);

    return {
      intent: "support_request",
      shouldPersistFeedback: false,
      feedbackType: undefined,
      buttons: createLeadCrmButtons(leadId),
      normalizedActions: leadId ? ["open_crm"] : [],
      text: leadId
        ? `I can help with lead ${leadId}: KP documents, follow-ups, CRM status, and what is waiting next.`
        : "I can help with leads, KP documents, follow-ups, and CRM status. Ask me about a lead or send source material."
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
      text: leadId
        ? `I can help with lead ${leadId}: KP documents, follow-ups, CRM status, and what is waiting next.`
        : "I can help with leads, KP documents, follow-ups, and CRM status. Ask me about a lead or send source material."
    };
  }

  if (leadChatResponse) {
    return leadChatResponse;
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

function isPrioritySupportRequest(content: string, intent: string): boolean {
  return (
    intent === "support_request" &&
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
      : "In Telegram, reply to a lead card to update that exact lead.";

  return [
    "Hi, I am Oleg's CRM assistant.",
    "I can create and update leads, read source materials, track missing KP fields, prepare KP documents, mark KP as sent, and explain what is waiting next.",
    uploadHint,
    "I only save feature requests when the message is clearly product feedback."
  ].join("\n\n");
}
