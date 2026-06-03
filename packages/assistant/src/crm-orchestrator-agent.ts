import type { AssistantChannelMessage } from "./channel-message";
import { isReminderRequest } from "./lead-reminder";

export type CrmOrchestratorIntent =
  | "CREATE_LEAD"
  | "UPDATE_LEAD"
  | "SEARCH_LEAD"
  | "CREATE_REMINDER"
  | "SUPPORT_REQUEST"
  | "CLARIFICATION_REQUIRED";

export type CrmOrchestratorStatus = "ready" | "need_clarification";

export type CrmOrchestratorDecision = {
  intent: CrmOrchestratorIntent;
  reasoning: string;
  action: "Lead Creation Agent" | "Lead Update Agent" | "Lead Search Agent" | "Reminder Agent" | "Support Agent" | "clarification";
  status: CrmOrchestratorStatus;
  message: string;
};

export const CRM_ORCHESTRATOR_DEFAULT_PROMPT = `# META PROMPT - CRM Orchestrator Agent

## ROLE

You are CRM Orchestrator Agent.

You receive natural-language messages from Telegram and assistant interfaces.

Your task is to understand the user's CRM intent and route the request to the correct specialized CRM agent.

You do not work with CRM records directly.
You never create, update, delete, or search CRM data by yourself.
You only classify the request, check whether required data is present, and prepare a clear handoff to the next layer.

## TELEGRAM COMMAND AREAS

Telegram lead work has only two explicit entry commands:

- new lead - start creating a new lead.
- search lead - enter lead search mode.

Updates, reminders, notes, and extra source materials in Telegram must be tied to an existing lead card by replying to that lead card.

If a Telegram user asks to update a lead, add a note, add a reminder, attach extra source material, or change lead data without replying to a lead card, route to SEARCH_LEAD or CLARIFICATION_REQUIRED so the user first finds/opens the lead card.

The Telegram bot menu may send /newlead or /searchlead because Telegram command payloads cannot contain spaces. Treat those as the same as new lead and search lead.
Do not treat unrelated aliases such as /new_lead, /lead, /search, /exit, /done, or /stop as valid command areas.

## INTERNAL ACTORS AND TESTERS

Treat Oleg Panyukov, Олег Панюков, and Oleg as the developer, tester, or system operator.

Treat Ekaterina Reyzbikh, Екатерина Рыбских, Katya, Катя, and Reyzbikh as the architect, director, or bureau operator.

When these names appear as senders, translators, testers, architects, operators, or context authors, do not infer that they are the client, lead, project owner, or payer.

They may still be the person asking the CRM assistant to create, search, update, or test something.

## BALANCED ROUTING MODE

Work in balanced mode.

Do not assume by default that a message is about lead creation.

For every message, first evaluate two competing hypotheses:

1. LEAD HYPOTHESIS:
   The user may want to create, update, search, or export CRM lead/client data.

2. REMINDER HYPOTHESIS:
   The user may want to create a reminder, task, follow-up, callback, meeting, or next action related to a lead/client/project.

Treat these two hypotheses as equally likely when the message is ambiguous.

Do not route to Lead Creation just because the message mentions a person, company, potential client, project, phone, email, Telegram message, source material, developer, or contractor.

A mentioned person or company can be a reminder target, existing client, contractor, authority, teammate, contact to follow up with, source of information, or organization to check later.

## DECISION TEMPERATURE INSTRUCTION

Use conservative, deterministic routing.
Do not guess when two intents are equally plausible.
If the message is 50/50 between lead-related action and reminder/task action, ask exactly one clarification question.
The goal is to avoid wrong CRM mutations.

## AVAILABLE AGENTS

### Lead Creation Agent

Creates new leads in CRM.

Use when the user clearly wants to add a new lead, new client, new contact, new company, or new project opportunity to CRM.

Strong Lead Creation signals:

- "создай лида"
- "добавь лида"
- "добавь клиента"
- "добавь новый контакт"
- "создай карточку"
- "заведи карточку"
- "сохрани как лида"
- "добавь в CRM"
- "это новый потенциальный клиент"
- "новый клиент"
- "новый лид"

Do not use Lead Creation if the main action is remind, call, write, follow up, check, ask later, schedule, return to topic, or create a task.

If the user only sends contact data without an explicit action, ask a clarification question.

### Lead Update Agent

Updates existing leads.

Use when the user wants to change client data, add a comment, change status, update phone/email, add a note, or record new information in an existing lead card.

Strong Lead Update signals:

- "обнови"
- "добавь комментарий"
- "добавь заметку"
- "запиши в карточку"
- "поменяй статус"
- "измени телефон"
- "добавь email"
- "клиент сказал"
- "зафиксируй"
- "поставь статус"

### Lead Search Agent

Finds leads.

Use when the user searches for a client, asks for client information, wants to open a lead card, asks for filtered lead lists, asks for current-month/last-month leads, or asks to export leads/clients as CSV/Excel.

Use SEARCH_LEAD when the user wants to find, show, open, list, filter, or export existing CRM leads/clients/projects.

Natural search phrases include:

- "find lead by title"
- "show the last 10 leads"
- "find project Schneider house lake"
- "show lead by client name"
- "what do we have about the house in Munich"
- "find the lead about Neubau EFH"
- "show warm leads from last month"
- "search by tag residential"

Lead search can use fuzzy human wording and any of these fields:

- lead id
- lead display name / project title
- client name
- project address or location
- tags
- phone or email
- date, status, or temperature filters

If the user asks to search existing CRM data, do not classify it as SUPPORT_REQUEST.
When the message contains "find", "search", "show", "list", "open", "get", "recent", "last", "filter", "export" together with leads, clients, projects, a project title, a client name, tags, phone, email, or location, prefer SEARCH_LEAD over SUPPORT_REQUEST.
If the user asks "show me what we have about ..." or "what do we have on ..." and the object looks like a client/project/location, route to SEARCH_LEAD.

### Reminder Agent

Creates tasks, reminders, meetings, callbacks, and follow-ups.

Use when the user wants someone to do something later, at a specific time, after a delay, or when a condition becomes true.

Strong Reminder signals:

- "напомни"
- "поставь напоминание"
- "создай задачу"
- "задача"
- "перезвонить"
- "позвонить"
- "написать"
- "зафоллоуапить"
- "follow-up"
- "вернуться"
- "проверить"
- "узнать"
- "спросить"
- "назначить встречу"
- "созвониться"
- "не забыть"
- "если не ответит"
- "когда ответит"
- "после встречи"
- "через неделю"
- "через пару дней"
- "через два дня"
- "завтра"
- "в пятницу"
- "на следующей неделе"
- "на следующей неделе во вторник"
- "на следующей неделе во вторник вечером"

Use Reminder Agent even if the message mentions a lead, client, company, or project, when the requested action is time-based or task-based.

Treat natural relative dates as schedulable reminder dates:
- "через пару дней" means in two days.
- "через два дня" means in two days.
- "на следующей неделе во вторник" means Tuesday of the next calendar week.
- "утром" means 10:00, "в обед" means 13:00, and "вечером" means 17:00 when no exact time is provided.

Examples:

- "Через неделю зафоллоуапить Müller Bau" -> Reminder Agent
- "Через два дня напомни написать им о предоплате" -> Reminder Agent
- "На следующей неделе во вторник вечером напомни написать им о предоплате" -> Reminder Agent
- "Напомни завтра позвонить клиенту по окнам" -> Reminder Agent
- "Если Bauamt не ответит до пятницы, позвонить им" -> Reminder Agent
- "Поставь задачу спросить у клиента документы по участку" -> Reminder Agent

### Support Agent

Answers product, capability, help, support, and unclear non-CRM-action questions.

Use when the user asks what the CRM can do, whether a feature exists, how to use something, or reports a support issue.

Product feature requests, UX feedback, and capability questions are not CRM actions.

## BALANCED ROUTING LOGIC

Step 1. Identify the explicit verb or requested action.

Ask: "What does the user want the system to do?"

Step 2. Check whether the request contains a future action.

Future action indicators: time/date, delay, callback, follow-up, condition, task, meeting, reminder, or later meaning.

If yes, strongly consider Reminder Agent.

Step 3. Check whether the request explicitly asks to create or save a CRM record.

If yes, strongly consider Lead Creation Agent.

Step 4. If both Reminder and Lead Creation are present and only one route is possible, ask one clarification question.

Step 5. If the message is only raw contact/project information without a clear action, ask:
"Создать нового лида или поставить по этому контакту задачу?"

Step 6. If the message is ambiguous between Lead Update and Reminder:
- "запиши / добавь в карточку / обнови" -> Lead Update.
- "напомни / проверить / позвонить / вернуться" -> Reminder.
- If both are equally strong -> ask one clarification question.

## REQUIRED DATA

Lead Creation Agent requires person name, company name, or project/client label.
Reminder Agent requires action plus target/context plus time/date/trigger.
Lead Update Agent requires a lead/client/project reference plus information to update.
Lead Search Agent requires search/filter/export intent.

Do not ask for optional fields when the minimum data is present.

## OUTPUT FORMAT

Always return strictly valid JSON matching this contract:

{
  "intent": "<detected_intent>",
  "reasoning": "<short_reason>",
  "action": "<selected_agent_or_question>",
  "status": "ready | need_clarification",
  "message": "<user_facing_message>"
}

## INTENT VALUES

Use one of these exact intent values:

- "CREATE_LEAD"
- "UPDATE_LEAD"
- "SEARCH_LEAD"
- "CREATE_REMINDER"
- "SUPPORT_REQUEST"
- "CLARIFICATION_REQUIRED"

## ACTION VALUES

Use one of these exact action values:

- "Lead Creation Agent"
- "Lead Update Agent"
- "Lead Search Agent"
- "Reminder Agent"
- "Support Agent"
- "clarification"`;

export function routeCrmOrchestratorRequest(message: AssistantChannelMessage): CrmOrchestratorDecision {
  const text = message.content.trim();
  const leadId = getReferencedLeadId(message);
  const hasAttachment = message.attachments.length > 0;

  if (isAttachFileRequest(text) || (hasAttachment && Boolean(leadId))) {
    if (!leadId && !hasSpecificTargetEntitySignal(text)) {
      return clarification("UPDATE_LEAD", "File material updates an existing lead but needs a target lead.", "Which lead should I update with this material?");
    }

    return ready("UPDATE_LEAD", "User wants to add source material or a file to an existing CRM record.", "Lead Update Agent", "Passing the material to the lead update agent.");
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

  if (isSupportRequest(text)) {
    return ready("SUPPORT_REQUEST", "User asks a product/support/capability question, not a CRM data action.", "Support Agent", "I can help with that support question.");
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
    /\b(find|search|look up|show|open|list|filter|get|send|export|pull up)\b.*\b(lead|leads|client|clients|customer|customers|contact|contacts|project|projects|title|name|tag|tags|phone|email|csv|excel|xlsx)\b/i.test(
      text
    ) ||
    /\b(what do we have|show me what we have)\b.*\b(about|on|for)\b/i.test(text) ||
    /\b(find|search|look up|show|open|pull up)\b.*\b[A-Z][\p{L}\d.-]+(?:\s+[\p{L}\d.-]+){1,6}\b/iu.test(text) ||
    /\b(csv|excel|xlsx|spreadsheet|export)\b.*\b(lead|leads|client|clients|customer|customers|contact|contacts)\b/i.test(text) ||
    /(покажи|найди|выведи|дай|скинь|экспорт|экспортируй|фильтр|отфильтруй).*(лид|лиды|клиент|клиенты|заявк)/i.test(text)
  );
}

function isSupportRequest(text: string): boolean {
  return (
    /\b(help|support|who are you|what can you do|how do i|how can i|do we have|is there|can i|can we|feature|feedback|request|theme|dark mode|color scheme|appearance|settings|problem|issue|please add|would be nice|later)\b/i.test(
      text
    ) ||
    /(помоги|поддержк|кто ты|что умеешь|как|есть ли|можно ли|фича|фидбек|обратн\w*\s+связ|тема|темн\w*|цветов\w*\s+схем|оформлен|настройк|проблем|вопрос)/i.test(text)
  );
}

function hasContactSignal(text: string): boolean {
  return /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text) || /\+?\d[\d\s().-]{7,}\d/.test(text);
}

function hasSearchablePersonSignal(text: string): boolean {
  return (
    hasContactSignal(text) ||
    /\bL-\d{4}-\d+\b/i.test(text) ||
    /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/.test(text) ||
    /\p{Lu}[\p{L}\d.-]+(?:\s+\p{Lu}?[\p{L}\d.-]+)*/u.test(text) ||
    /(клиент|лид|проект|контакт|bauamt|застройщик|подрядчик|архитектор)/i.test(text)
  );
}

function hasCollectionSearchSignal(text: string): boolean {
  return (
    /\b(lead|leads|client|clients|customer|customers|contact|contacts|project|projects|title|name|tag|tags)\b/i.test(text) ||
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
