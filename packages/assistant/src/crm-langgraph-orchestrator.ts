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
    .addNode("updateLead", updateLeadNode)
    .addNode("createReminder", createReminderNode)
    .addNode("addContextNote", addContextNoteNode)
    .addNode("clarify", clarifyNode)
    .addNode("noAction", noActionNode)
    .addEdge(START, "classify")
    .addConditionalEdges("classify", (state) => state.route, {
      create_lead: "createLead",
      update_lead: "updateLead",
      create_reminder: "createReminder",
      add_context_note: "addContextNote",
      clarify: "clarify",
      no_action: "noAction"
    })
    .addEdge("createLead", END)
    .addEdge("updateLead", END)
    .addEdge("createReminder", END)
    .addEdge("addContextNote", END)
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

  if (targetLeadId && (isLeadInteractionNoteCommand(text) || isLeadNaturalContextNote(text))) {
    return { route: "add_context_note" };
  }

  if (targetLeadId) {
    return { route: "update_lead" };
  }

  if (hasNewLeadSignal(text) || (input.attachments?.length ?? 0) > 0 || hasLeadSourceMaterialSignal(text)) {
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
        message: "I can help create leads, update a replied lead, add reminders, or save context notes.",
        reason: "No supported Telegram CRM action was detected."
      },
      responseText: "I can help create leads, update a replied lead, add reminders, or save context notes."
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

function hasMutationWithoutLeadSignal(text: string): boolean {
  return (
    Boolean(detectLeadFieldCommand(text)) ||
    isReminderRequest(text) ||
    isLeadInteractionNoteCommand(text) ||
    isLeadNaturalContextNote(text)
  );
}
