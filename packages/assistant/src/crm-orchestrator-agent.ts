import type { AssistantChannelMessage } from "./channel-message";
import { isReminderRequest } from "./lead-reminder";

export type CrmOrchestratorIntent =
  | "CREATE_LEAD"
  | "UPDATE_LEAD"
  | "SEARCH_LEAD"
  | "CREATE_REMINDER"
  | "ATTACH_FILE"
  | "CLARIFICATION_REQUIRED";

export type CrmOrchestratorStatus = "ready" | "need_clarification";

export type CrmOrchestratorDecision = {
  intent: CrmOrchestratorIntent;
  reasoning: string;
  action: "Lead Creation Agent" | "Lead Update Agent" | "Lead Search Agent" | "Reminder Agent" | "File Attachment Agent" | "clarification";
  status: CrmOrchestratorStatus;
  message: string;
};

export const CRM_ORCHESTRATOR_DEFAULT_PROMPT = `# META PROMPT - CRM Orchestrator Agent

## ROLE

You are CRM Orchestrator Agent.

Your task is to understand natural-language user requests and route them to the correct specialized CRM agent.

You do not work with CRM records directly and never change data by yourself.

You only route requests and check whether the required data is present.

## AVAILABLE AGENTS

### Lead Creation Agent

Creates new leads in CRM.

Use when the user wants to add a client, create a new contact, create a lead, or sends source material for a new potential client.

### Lead Update Agent

Updates existing leads.

Use when the user wants to change client data, add a comment, change status, update phone/email, or add a note.

### Lead Search Agent

Finds leads.

Use when the user searches for a client, asks for client information, wants to open a lead card, asks for filtered lead lists, asks for last-month/current-month leads, or asks to export leads/clients as CSV/Excel.

### Reminder Agent

Creates tasks and reminders.

Use when the user asks to call back, create a task, create a follow-up, schedule a meeting, or set a reminder.

### File Attachment Agent

Attaches files to CRM entities.

Use when the user wants to add a document, attach a contract, upload an invoice, attach a PDF, or add an image.

## WORKFLOW

1. Understand intent.
2. Check required data.
3. If data is missing, ask exactly one clarification question.
4. If data is enough, route to the selected agent.
5. Return a short result.

## OUTPUT FORMAT

Always return JSON:

{
  "intent": "<detected_intent>",
  "reasoning": "<short_reason>",
  "action": "<selected_agent_or_question>",
  "status": "ready | need_clarification",
  "message": "<user_facing_message>"
}`;

export function routeCrmOrchestratorRequest(message: AssistantChannelMessage): CrmOrchestratorDecision {
  const text = message.content.trim();
  const leadId = getReferencedLeadId(message);
  const hasAttachment = message.attachments.length > 0;

  if (isAttachFileRequest(text) || (hasAttachment && Boolean(leadId))) {
    if (!leadId && !hasSpecificTargetEntitySignal(text)) {
      return clarification("ATTACH_FILE", "File attachment needs a target CRM entity.", "Which lead should I attach this file to?");
    }

    return ready("ATTACH_FILE", "User wants to attach source material or a file.", "File Attachment Agent", "Passing the file to the attachment agent.");
  }

  if (isReminderRequestText(text)) {
    if (!leadId && !hasSearchablePersonSignal(text)) {
      return clarification("CREATE_REMINDER", "Reminder needs a lead, person, or searchable target.", "Who should this reminder be attached to?");
    }

    return ready("CREATE_REMINDER", "User wants to create a reminder or follow-up.", "Reminder Agent", "Passing the request to the reminder agent.");
  }

  if (isCreateLeadRequest(text)) {
    if (!hasContactSignal(text)) {
      return clarification("CREATE_LEAD", "Lead creation needs at least one contact field.", "What phone or email should I save for this new lead?");
    }

    return ready("CREATE_LEAD", "User wants to create a new lead.", "Lead Creation Agent", "Passing the request to the lead creation agent.");
  }

  if (isSearchLeadRequest(text)) {
    if (!hasSearchablePersonSignal(text) && !hasCollectionSearchSignal(text)) {
      return clarification("SEARCH_LEAD", "Lead search needs a name, phone, email, company, or lead id.", "Which client should I search for?");
    }

    return ready("SEARCH_LEAD", "User wants to search, filter, list, or export CRM records.", "Lead Search Agent", "Passing the request to the lead search agent.");
  }

  if (leadId || isUpdateLeadRequest(text)) {
    if (!leadId && !hasSearchablePersonSignal(text)) {
      return clarification("UPDATE_LEAD", "Lead update needs a lead id or searchable client data.", "Which client or lead should I update?");
    }

    return ready("UPDATE_LEAD", "User wants to update an existing lead.", "Lead Update Agent", "Passing the request to the lead update agent.");
  }

  return clarification("CLARIFICATION_REQUIRED", "The request is ambiguous.", "Do you want me to create a new lead or update an existing lead?");
}

function ready(
  intent: Exclude<CrmOrchestratorIntent, "CLARIFICATION_REQUIRED">,
  reasoning: string,
  action: Exclude<CrmOrchestratorDecision["action"], "clarification">,
  message: string
): CrmOrchestratorDecision {
  return { intent, reasoning, action, status: "ready", message };
}

function clarification(intent: CrmOrchestratorIntent, reasoning: string, message: string): CrmOrchestratorDecision {
  return { intent, reasoning, action: "clarification", status: "need_clarification", message };
}

function getReferencedLeadId(message: AssistantChannelMessage): string | null {
  return (
    message.replyTo?.leadId ??
    /\bL-\d{4}-\d+\b/i.exec(message.content)?.[0]?.toUpperCase() ??
    message.context.selectedRecordIds?.find((id) => /^L-\d{4}-\d+$/i.test(id)) ??
    null
  );
}

function isAttachFileRequest(text: string): boolean {
  return /\b(attach|upload|add|save)\b.*\b(file|pdf|document|contract|invoice|image|photo)\b/i.test(text);
}

function hasSpecificTargetEntitySignal(text: string): boolean {
  return /\bL-\d{4}-\d+\b/i.test(text) || /\b(lead|client|customer)\b/i.test(text);
}

function isReminderRequestText(text: string): boolean {
  return isReminderRequest(text) || /\b(remind|reminder|follow[-\s]?up|call back|schedule|meeting|task)\b/i.test(text);
}

function isUpdateLeadRequest(text: string): boolean {
  return /\b(update|change|edit|add|save|append|note|comment|status|phone|email)\b/i.test(text) && /\b(lead|client|customer|record|note|comment|status|phone|email)\b/i.test(text);
}

function isCreateLeadRequest(text: string): boolean {
  return (
    /\b(add|create|capture|register|import)\b.*\b(lead|client|customer|contact)\b/i.test(text) ||
    hasMultipleLeadCreationSignals(text)
  );
}

function isSearchLeadRequest(text: string): boolean {
  return (
    /\b(find|search|look up|show|open|list|filter|get|send|export)\b.*\b(lead|leads|client|clients|customer|customers|contact|contacts|phone|email|csv|excel|xlsx)\b/i.test(
      text
    ) ||
    /\b(csv|excel|xlsx|spreadsheet|export)\b.*\b(lead|leads|client|clients|customer|customers|contact|contacts)\b/i.test(text) ||
    /(покажи|найди|выведи|дай|скинь|экспорт|экспортируй|фильтр|отфильтруй).*(лид|лиды|клиент|клиенты|заявк)/i.test(text)
  );
}

function hasContactSignal(text: string): boolean {
  return /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text) || /\+?\d[\d\s().-]{7,}\d/.test(text);
}

function hasSearchablePersonSignal(text: string): boolean {
  return hasContactSignal(text) || /\bL-\d{4}-\d+\b/i.test(text) || /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/.test(text);
}

function hasCollectionSearchSignal(text: string): boolean {
  return (
    /\b(lead|leads|client|clients|customer|customers|contact|contacts)\b/i.test(text) ||
    /\b(csv|excel|xlsx|spreadsheet|export)\b/i.test(text) ||
    /\b(last|this|current|previous)\s+(month|week|year)\b/i.test(text) ||
    /\b(hot|warm|cold|new|needs_data|sent|signed)\b/i.test(text) ||
    /(лид|лиды|клиент|клиенты|заявк|прошл\w*\s+месяц|текущ\w*\s+месяц|тепл\w*|горяч\w*|холодн\w*)/i.test(text)
  );
}

function hasMultipleLeadCreationSignals(text: string): boolean {
  const signals = [
    /\b(client|customer|lead|contact)\b/i,
    /\b(project|house|apartment|architecture|commercial proposal|offer|request)\b/i,
    /\b(address|street|bgf|m2|sqm|budget)\b/i,
    hasContactSignal
  ];

  return signals.filter((signal) => (typeof signal === "function" ? signal(text) : signal.test(text))).length >= 3;
}
