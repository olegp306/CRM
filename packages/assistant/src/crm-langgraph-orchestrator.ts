import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { type LeadFieldCommand, detectLeadFieldCommand } from "./lead-field-command";
import { isLeadInteractionNoteCommand, isLeadNaturalContextNote } from "./lead-interaction-note";
import { createLeadReminderDraft, isReminderRequest } from "./lead-reminder";

export type CrmLangGraphMessageInput = {
  workspaceId: string;
  channel: "telegram" | "web";
  chatId?: string;
  messageId?: string;
  text: string;
  receivedAt?: string;
  replyToLeadId?: string | null;
  selectedLeadId?: string | null;
  attachments?: Array<{
    id?: string;
    kind: "image" | "pdf" | "audio" | "document" | "unknown";
    fileName?: string | null;
    summary?: string | null;
  }>;
};

export type CrmLangGraphAction =
  | {
      type: "create_lead";
      reason: string;
    }
  | {
      type: "update_lead";
      leadId: string;
      fieldCommand: LeadFieldCommand | null;
      reason: string;
    }
  | {
      type: "attach_material_to_lead";
      leadId: string | null;
      leadRef: string;
      fieldCommand: LeadFieldCommand | null;
      materialKinds: Array<"image" | "pdf" | "audio" | "document" | "unknown">;
      instruction: string | null;
      reason: string;
    }
  | {
      type: "create_reminder";
      leadId: string;
      summary: string;
      dueAt: string | null;
      recurrence: "yearly" | null;
      reason: string;
    }
  | {
      type: "add_context_note";
      leadId: string;
      note: string;
      reason: string;
    }
  | {
      type: "search_leads";
      query: string | null;
      reason: string;
    }
  | {
      type: "clarify";
      question: string;
      reason: string;
    }
  | {
      type: "no_action";
      message: string;
      reason: string;
    };

export type CrmLangGraphResult = {
  runtime: "langgraph";
  action: CrmLangGraphAction;
  responseText: string;
};

type CrmLangGraphRoute = CrmLangGraphAction["type"];

const GraphState = Annotation.Root({
  input: Annotation<CrmLangGraphMessageInput>(),
  route: Annotation<CrmLangGraphRoute>(),
  result: Annotation<CrmLangGraphResult>()
});

export async function runCrmLangGraphOrchestrator(input: CrmLangGraphMessageInput): Promise<CrmLangGraphResult> {
  const graph = createCrmLangGraphOrchestrator();
  const state = await graph.invoke({ input });
  return state.result;
}

export function createCrmLangGraphOrchestrator() {
  return new StateGraph(GraphState)
    .addNode("classify", classifyNode)
    .addNode("createLead", createLeadNode)
    .addNode("attachMaterialToLead", attachMaterialToLeadNode)
    .addNode("updateLead", updateLeadNode)
    .addNode("createReminder", createReminderNode)
    .addNode("addContextNote", addContextNoteNode)
    .addNode("searchLeads", searchLeadsNode)
    .addNode("clarify", clarifyNode)
    .addNode("noAction", noActionNode)
    .addEdge(START, "classify")
    .addConditionalEdges("classify", (state) => state.route, {
      create_lead: "createLead",
      attach_material_to_lead: "attachMaterialToLead",
      update_lead: "updateLead",
      create_reminder: "createReminder",
      add_context_note: "addContextNote",
      search_leads: "searchLeads",
      clarify: "clarify",
      no_action: "noAction"
    })
    .addEdge("createLead", END)
    .addEdge("attachMaterialToLead", END)
    .addEdge("updateLead", END)
    .addEdge("createReminder", END)
    .addEdge("addContextNote", END)
    .addEdge("searchLeads", END)
    .addEdge("clarify", END)
    .addEdge("noAction", END)
    .compile();
}

function classifyNode(state: typeof GraphState.State): Partial<typeof GraphState.State> {
  const input = state.input;
  const text = input.text.trim();
  const targetLeadId = input.replyToLeadId ?? input.selectedLeadId ?? null;

  if (!text && (input.attachments?.length ?? 0) === 0) {
    return { route: "no_action" };
  }

  if (targetLeadId && isReminderRequest(text)) {
    return { route: "create_reminder" };
  }

  if (shouldAttachMaterialToLead(input, targetLeadId)) {
    return { route: "attach_material_to_lead" };
  }

  if (targetLeadId && (isLeadInteractionNoteCommand(text) || isLeadNaturalContextNote(text))) {
    return { route: "add_context_note" };
  }

  if (targetLeadId) {
    return { route: "update_lead" };
  }

  if (hasExplicitLeadReference(text) && ((input.attachments?.length ?? 0) > 0 || hasLeadSourceMaterialSignal(text) || Boolean(detectLeadFieldCommand(text)))) {
    return { route: "attach_material_to_lead" };
  }

  if (hasNewLeadSignal(text) || (input.attachments?.length ?? 0) > 0) {
    return { route: "create_lead" };
  }

  if (hasLeadSearchSignal(text)) {
    return { route: "search_leads" };
  }

  if (hasLeadSourceMaterialSignal(text)) {
    return { route: "create_lead" };
  }

  if (hasMutationWithoutLeadSignal(text)) {
    return { route: "clarify" };
  }

  return { route: "no_action" };
}

function createLeadNode(state: typeof GraphState.State): Partial<typeof GraphState.State> {
  return {
    result: {
      runtime: "langgraph",
      action: {
        type: "create_lead",
        reason: "The message contains new lead/source material signals and no target lead context."
      },
      responseText: "LangGraph will create a new lead from this Telegram material."
    }
  };
}

function updateLeadNode(state: typeof GraphState.State): Partial<typeof GraphState.State> {
  const leadId = getTargetLeadId(state.input);
  const fieldCommand = detectLeadFieldCommand(state.input.text);

  return {
    result: {
      runtime: "langgraph",
      action: {
        type: "update_lead",
        leadId,
        fieldCommand,
        reason: fieldCommand
          ? `The reply targets ${leadId} and contains a field update command.`
          : `The reply targets ${leadId}; source material should be merged into the lead.`
      },
      responseText: `LangGraph will update lead ${leadId}.`
    }
  };
}

function attachMaterialToLeadNode(state: typeof GraphState.State): Partial<typeof GraphState.State> {
  const input = state.input;
  const reference = extractExplicitLeadReference(input.text);
  const leadId = input.replyToLeadId ?? input.selectedLeadId ?? reference?.leadId ?? null;
  const leadRef = reference?.raw ?? leadId ?? "unknown";
  const fieldCommand = detectLeadFieldCommand(input.text);
  const materialKinds = normalizeLangGraphMaterialKinds(input.attachments);
  const instruction = normalizeLeadMaterialInstruction(input.text, reference?.raw);

  return {
    result: {
      runtime: "langgraph",
      action: {
        type: "attach_material_to_lead",
        leadId,
        leadRef,
        fieldCommand,
        materialKinds,
        instruction,
        reason: leadId
          ? `The message explicitly targets existing lead ${leadId}; incoming material should be merged into that lead.`
          : `The message explicitly references lead ${leadRef}; resolve it before merging incoming material.`
      },
      responseText: leadId
        ? `LangGraph will attach this material to lead ${leadId}.`
        : `LangGraph needs to resolve lead ${leadRef} before attaching this material.`
    }
  };
}

function createReminderNode(state: typeof GraphState.State): Partial<typeof GraphState.State> {
  const leadId = getTargetLeadId(state.input);
  const draft = createLeadReminderDraft(state.input.text, { now: new Date(state.input.receivedAt ?? Date.now()) });

  return {
    result: {
      runtime: "langgraph",
      action: {
        type: "create_reminder",
        leadId,
        summary: draft.summary,
        dueAt: draft.dueAt?.toISOString() ?? null,
        recurrence: draft.recurrence,
        reason: `The reply targets ${leadId} and contains reminder/follow-up language.`
      },
      responseText: draft.dueAt
        ? `LangGraph will add a reminder for lead ${leadId}.`
        : `LangGraph needs a date before it can add this reminder for lead ${leadId}.`
    }
  };
}

function addContextNoteNode(state: typeof GraphState.State): Partial<typeof GraphState.State> {
  const leadId = getTargetLeadId(state.input);
  const note = state.input.text.trim();

  return {
    result: {
      runtime: "langgraph",
      action: {
        type: "add_context_note",
        leadId,
        note,
        reason: `The reply targets ${leadId} and contains client context or a note command.`
      },
      responseText: `LangGraph will save this as context for lead ${leadId}.`
    }
  };
}

function searchLeadsNode(state: typeof GraphState.State): Partial<typeof GraphState.State> {
  const query = normalizeLeadSearchQueryForAction(state.input.text);

  return {
    result: {
      runtime: "langgraph",
      action: {
        type: "search_leads",
        query,
        reason: query
          ? "The message asks to search or filter CRM leads using natural language."
          : "The message asks to enter lead search mode or list recent leads."
      },
      responseText: query ? `LangGraph will search leads for ${query}.` : "LangGraph will show recent leads."
    }
  };
}

function clarifyNode(state: typeof GraphState.State): Partial<typeof GraphState.State> {
  return {
    result: {
      runtime: "langgraph",
      action: {
        type: "clarify",
        question: "Which lead should I update? Search for the lead first, open its Telegram card, and reply to that card.",
        reason: "The message asks for a CRM mutation but does not target a lead."
      },
      responseText: "Which lead should I update? Search for the lead first, open its Telegram card, and reply to that card."
    }
  };
}

function noActionNode(): Partial<typeof GraphState.State> {
  return {
    result: {
      runtime: "langgraph",
      action: {
        type: "no_action",
        message: "I can help create leads, search leads, update a replied lead, add reminders, or save context notes.",
        reason: "No supported Telegram CRM action was detected."
      },
      responseText: "I can help create leads, search leads, update a replied lead, add reminders, or save context notes."
    }
  };
}

function getTargetLeadId(input: CrmLangGraphMessageInput): string {
  const leadId = input.replyToLeadId ?? input.selectedLeadId;
  if (!leadId) {
    throw new Error("A target lead is required for this LangGraph route.");
  }

  return leadId;
}

export type ExplicitLeadReference = {
  raw: string;
  leadId: string | null;
  numericSuffix: string | null;
};

export function extractExplicitLeadReference(text: string | undefined): ExplicitLeadReference | null {
  const value = text?.trim() ?? "";
  const full = /\b(L-\d{4}-(\d+))\b/i.exec(value);
  if (full) {
    return {
      raw: full[1],
      leadId: full[1].toUpperCase(),
      numericSuffix: normalizeLeadReferenceSuffix(full[2])
    };
  }

  const short =
    /\b(?:to|for|lead|attach(?:\s+to)?|add(?:\s+to)?|merge(?:\s+to)?|relates?\s+to)\s+(?:lead\s+)?0*(\d{1,5})\b/i.exec(value) ??
    /(?:к|для)\s+(?:лид[ау]?|заявк[еуы]?|карточк[еуы]?)?\s*0*(\d{1,5})\b/iu.exec(value) ??
    /(?:лид[ау]?|заявк[еуы]?|карточк[еуы]?)\s*0*(\d{1,5})\b/iu.exec(value) ??
    /(?:относит[а-яё]*\s+к|добавь\s+к|прикрепи\s+к|прислюнь\s+к|слей\s+к)\s+(?:лид[ау]?|заявк[еуы]?)?\s*0*(\d{1,5})\b/iu.exec(value);

  const suffix = normalizeLeadReferenceSuffix(short?.[1]);
  if (!suffix) {
    return null;
  }

  return {
    raw: short?.[0]?.trim() ?? suffix,
    leadId: null,
    numericSuffix: suffix
  };
}

function hasExplicitLeadReference(text: string): boolean {
  return Boolean(extractExplicitLeadReference(text));
}

function normalizeLeadReferenceSuffix(value: string | undefined): string | null {
  const numeric = value?.replace(/^0+/, "") ?? "";
  if (!numeric || !/^\d{1,5}$/.test(numeric)) {
    return null;
  }

  return numeric.padStart(3, "0");
}

function shouldAttachMaterialToLead(input: CrmLangGraphMessageInput, targetLeadId: string | null): boolean {
  const hasAttachments = (input.attachments?.length ?? 0) > 0;
  const hasExplicitRef = hasExplicitLeadReference(input.text);
  const hasInstruction = hasLeadSourceMaterialSignal(input.text) || Boolean(detectLeadFieldCommand(input.text));

  return Boolean((targetLeadId && (hasAttachments || hasExplicitRef)) || (hasExplicitRef && (hasAttachments || hasInstruction)));
}

function normalizeLangGraphMaterialKinds(attachments: CrmLangGraphMessageInput["attachments"]): Array<"image" | "pdf" | "audio" | "document" | "unknown"> {
  const kinds = (attachments ?? []).map((attachment) => attachment.kind);
  return kinds.length > 0 ? kinds : ["unknown"];
}

function normalizeLeadMaterialInstruction(text: string, leadRef: string | undefined): string | null {
  const withoutRef = leadRef ? text.replace(leadRef, " ") : text;
  const normalized = withoutRef.replace(/\s+/g, " ").trim();
  return normalized || null;
}

function hasNewLeadSignal(text: string): boolean {
  return /(^|\s)(\/newlead|new lead|new client|next client|create lead)\b|(?:новый\s+(?:лид|клиент)|следующий\s+(?:лид|клиент|потенциальный\s+клиент)|создай\s+лид)/i.test(
    text
  );
}

function hasLeadSourceMaterialSignal(text: string): boolean {
  return /(\b(?:commercial proposal|proposal|architecture|architectural|project|bgf|address|budget|phone|email|client|request)\b|(?:коммерческ|кп|архитект|проект|адрес|бюджет|площад|телефон|почта|заявк|клиент))/i.test(
    text
  );
}

function hasLeadSearchSignal(text: string): boolean {
  return (
    /(^|\s)(\/searchlead|\/search\s+lead|search\s+lead|find\s+lead|find\s+project|find\s+client|search\s+for|search\s+by|show\s+last|latest\s+\d+|last\s+\d+|recent\s+\d+|list\s+leads|open\s+lead|pull\s+up)\b/i.test(
      text
    ) ||
    /(?:найди|покажи|найти|ищи|открой)\s+(?:лид|лида|лиды|проект|проекты|клиент|клиента|последн|свеж)/i.test(text)
  );
}

function normalizeLeadSearchQueryForAction(text: string): string | null {
  const trimmed = text.trim();

  if (/^(?:\/searchlead(?:@\w+)?|\/search(?:@\w+)?\s+lead|search\s+lead)\s*$/i.test(trimmed)) {
    return null;
  }

  return trimmed || null;
}

function hasMutationWithoutLeadSignal(text: string): boolean {
  return (
    Boolean(detectLeadFieldCommand(text)) ||
    isReminderRequest(text) ||
    isLeadInteractionNoteCommand(text) ||
    isLeadNaturalContextNote(text)
  );
}
