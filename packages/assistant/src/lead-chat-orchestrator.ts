import type { AssistantChannelMessage, AssistantChannelResponse, AssistantChannelResponseButton } from "./channel-message";
import { createLeadChatActionButtons, createLeadChatActions, type LeadChatAction } from "./lead-action-orchestrator";

export type LeadChatNormalizedAction = "open_crm" | "open_pdf" | "download_doc" | "send_kp" | "mark_kp_sent" | "undo_kp_sent";

export type LeadChatSnapshot = {
  leadId: string;
  missingFields?: string[];
  kpReady?: boolean;
  pdfUrl?: string;
  docxUrl?: string;
  canSendKp?: boolean;
  kpSent?: boolean;
  clientEmail?: string | null;
  mailtoUrl?: string;
};

export type LeadChatOrchestratorInput = {
  message: AssistantChannelMessage;
  lead?: LeadChatSnapshot | null;
};

export function createLeadChatOrchestratorResponse(input: LeadChatOrchestratorInput): AssistantChannelResponse | null {
  const { message, lead } = input;
  const referencedLeadId = getReferencedLeadId(message);

  if (isNewLeadCommand(message.content)) {
    return {
      intent: "lead_intake",
      shouldPersistFeedback: false,
      feedbackType: undefined,
      buttons: [{ label: "Attach source", action: "open_upload" }],
      normalizedActions: [],
      text: "Send the client request, photos, PDFs, or raw source text. I will extract the lead fields and ask for confirmation before saving it in CRM."
    };
  }

  if (referencedLeadId && isLeadUpdateSourceMaterial(message)) {
    return {
      intent: "lead_update",
      shouldPersistFeedback: false,
      feedbackType: undefined,
      buttons: createLeadCrmButtons(referencedLeadId),
      normalizedActions: ["open_crm"],
      text: `I can update this lead ${referencedLeadId} from your message. I will merge new source material, fill missing KP fields when possible, and ask if the content looks like a different client.`
    };
  }

  if (lead) {
    const missingFields = lead.missingFields ?? [];

    if (missingFields.length > 0 || lead.kpReady === false) {
      return {
        intent: "support_request",
        shouldPersistFeedback: false,
        feedbackType: undefined,
        buttons: createLeadCrmButtons(lead.leadId),
        normalizedActions: ["open_crm"],
        text: `Lead ${lead.leadId} is not KP-ready yet. Missing fields: ${missingFields.length > 0 ? missingFields.join(", ") : "not confirmed"}.`
      };
    }

    if (lead.kpReady) {
      const actions = createLeadChatActions(lead);
      const buttons = createLeadChatActionButtons(actions);
      return {
        intent: "crm_action",
        shouldPersistFeedback: false,
        feedbackType: undefined,
        buttons,
        normalizedActions: actions.map((action) => action.type),
        text: `Lead ${lead.leadId} has enough data for KP. You can open CRM, review PDF, download DOC, send KP, or update the KP sent status.`
      };
    }
  }

  if (isLeadChatSourceMaterial(message)) {
    return {
      intent: "lead_intake",
      shouldPersistFeedback: false,
      feedbackType: undefined,
      buttons: [{ label: "Create lead", action: "confirm" }],
      normalizedActions: [],
      text: "I can create a lead from this source material. I will extract client, request, address, BGF, contacts, missing KP fields, and source references before saving."
    };
  }

  return null;
}

export function isNewLeadCommand(content: string): boolean {
  return /^\/(?:newlead|new_lead|lead)\b/i.test(content.trim()) || /^new lead$/i.test(content.trim());
}

export function isLeadChatSourceMaterial(message: AssistantChannelMessage): boolean {
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

function isLeadUpdateSourceMaterial(message: AssistantChannelMessage): boolean {
  const content = message.content.trim();
  return (
    message.attachments.length > 0 ||
    isLeadChatSourceMaterial(message) ||
    /\b(?:add|attach|update|fill|merge|save|append)\b/i.test(content) ||
    /(РґРѕР±Р°РІ|РѕР±РЅРѕРІ|Р·Р°РїРѕР»РЅ|РїСЂРёРєСЂРµРї|СЃРѕС…СЂР°РЅ)/i.test(content)
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

function createLeadCrmButtons(leadId: string): AssistantChannelResponseButton[] {
  return [{ label: "CRM", action: "open_crm", url: `/leads?leadId=${encodeURIComponent(leadId)}` }];
}

type _EnsureLeadChatNormalizedAction = LeadChatAction["type"] extends LeadChatNormalizedAction ? true : never;

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
    /\b(?:budget|price|cost)\b|бюджет|стоимость|цена/i
  ];

  return strongSignals.filter((signal) => signal.test(content)).length >= 3;
}
