import { classifyIntent } from "./classify-intent";
import type { AssistantChannelMessage, AssistantChannelResponse, AssistantChannelResponseButton } from "./channel-message";

export function createAssistantChannelResponse(message: AssistantChannelMessage): AssistantChannelResponse {
  const intent = classifyIntent(message.content);

  if (isHelpMessage(message.content, intent)) {
    return {
      intent: "help",
      shouldPersistFeedback: false,
      feedbackType: undefined,
      buttons: [],
      text: createSharedCapabilityMessage(message.channel)
    };
  }

  if (isNewLeadCommand(message.content)) {
    return {
      intent: "lead_intake",
      shouldPersistFeedback: false,
      feedbackType: undefined,
      buttons: [{ label: "Attach source", action: "open_upload" }],
      text: "Send the client request, photos, PDFs, or raw source text. I will extract the lead fields and ask for confirmation before saving it in CRM."
    };
  }

  if (isPersistedFeedbackIntent(intent)) {
    return {
      intent,
      shouldPersistFeedback: true,
      feedbackType: intent,
      buttons: [],
      text: "I saved this as product feedback for review."
    };
  }

  if (isPrioritySupportRequest(message.content, intent)) {
    const leadId = getReferencedLeadId(message);

    return {
      intent: "support_request",
      shouldPersistFeedback: false,
      feedbackType: undefined,
      buttons: createLeadCrmButtons(leadId),
      text: leadId
        ? `I can help with lead ${leadId}: KP documents, follow-ups, CRM status, and what is waiting next.`
        : "I can help with leads, KP documents, follow-ups, and CRM status. Ask me about a lead or send source material."
    };
  }

  if (isLeadSourceMaterial(message)) {
    return {
      intent: "lead_intake",
      shouldPersistFeedback: false,
      feedbackType: undefined,
      buttons: [{ label: "Create lead", action: "confirm" }],
      text: "I can create a lead from this source material. I will extract client, request, address, BGF, contacts, missing KP fields, and source references before saving."
    };
  }

  if (intent === "support_request") {
    const leadId = getReferencedLeadId(message);

    return {
      intent,
      shouldPersistFeedback: false,
      feedbackType: undefined,
      buttons: createLeadCrmButtons(leadId),
      text: leadId
        ? `I can help with lead ${leadId}: KP documents, follow-ups, CRM status, and what is waiting next.`
        : "I can help with leads, KP documents, follow-ups, and CRM status. Ask me about a lead or send source material."
    };
  }

  const responseIntent = intent === "permission_blocked" ? "other" : intent;

  return {
    intent: responseIntent,
    shouldPersistFeedback: false,
    feedbackType: undefined,
    buttons: [],
    text: "I can help with CRM leads. Send client text, photos, PDFs, or ask about the selected lead."
  };
}

function isHelpMessage(content: string, intent: string): boolean {
  if (/^\/(?:start|help)\b/i.test(content.trim())) {
    return true;
  }

  return intent === "support_request" && /(who are you|what can you do|кто ты|что умеешь)/i.test(content);
}

function isNewLeadCommand(content: string): boolean {
  return /^\/(?:newlead|new_lead|lead)\b/i.test(content.trim()) || /^new lead$/i.test(content.trim());
}

function isPersistedFeedbackIntent(intent: string): intent is "feature_request" | "bug_report" | "ux_feedback" {
  return intent === "feature_request" || intent === "bug_report" || intent === "ux_feedback";
}

function isPrioritySupportRequest(content: string, intent: string): boolean {
  return intent === "support_request" && /\b(?:help|support|status|what(?:'s| is)\s+the\s+status|where\s+is|check|update)\b/i.test(content);
}

function getReferencedLeadId(message: AssistantChannelMessage): string | null {
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
  if (message.channel !== "web") {
    return false;
  }

  if (message.attachments.length > 0) {
    return true;
  }

  const content = message.content.trim();
  if (content.length === 0) {
    return false;
  }

  if (isBareLeadActionRequest(content)) {
    return false;
  }

  return (
    (hasLeadIntakePhrase(content) && hasLeadRequestOrProposalSignal(content)) ||
    hasMultipleStrongKpSignalsInSourceParagraph(content)
  );
}

function isBareLeadActionRequest(content: string): boolean {
  return (
    /^\s*(?:help me\s+)?(?:add|create|capture|register|import)\s+(?:a\s+)?lead\b/i.test(content) &&
    !/\b(?:source material|client request|from this|attached|upload|uploaded|file|pdf|photo)\b/i.test(content)
  );
}

function hasLeadIntakePhrase(content: string): boolean {
  return /(\bsource material\b|\bclient request\b|\bcreate\s+(?:a\s+)?lead\b|\bcapture\s+(?:a\s+)?lead\b|\bregister\s+(?:a\s+)?lead\b|\bimport\s+(?:a\s+)?lead\b|\bextract\b.*\blead\b|заявк[аиу]\s+клиент[а-я]*|материал\s+для\s+лид[а-я]*|исходн(?:ый|ые|ого|ому)\s+материал|созда[йть]+\s+лид|добавь\s+лид|зарегистрируй\s+лид)/i.test(
    content
  );
}

function hasLeadRequestOrProposalSignal(content: string): boolean {
  return /(\blead\b|\bclient request\b|\bcommercial proposal\b|\brequest\b|\bproposal\b|заявк[аиу]|лид|клиент|коммерческ(?:ое|ого|ому|им)\s+предложени[еяю])/i.test(
    content
  );
}

function hasMultipleStrongKpSignalsInSourceParagraph(content: string): boolean {
  if (content.length < 80 && !content.includes("\n")) {
    return false;
  }

  const strongSignals = [
    /\bclient\b|клиент/i,
    /\bcommercial proposal\b|\bproposal\b|коммерческ(?:ое|ого|ому|им)\s+предложени[еяю]/i,
    /\bbgf\b|бгф|площадь/i,
    /\baddress\b|адрес/i,
    /\b(?:phone|tel|email|e-mail|contact)\b|телефон|почта|контакт/i,
    /\b(?:budget|price|cost)\b|бюджет|стоимост|цена/i
  ];

  return strongSignals.filter((signal) => signal.test(content)).length >= 3;
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
