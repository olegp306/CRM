import {
  createAssistantChannelResponse,
  createKpGeneratedEvent,
  createLeadChatActions,
  createLeadCreatedEvent,
  createLeadDraftUpdatedEvent,
  createLeadDisplayMetadata,
  createLeadInteractionNoteEvent,
  createLeadInteractionNoteSummary,
  createLeadNaturalContextSummary,
  createLeadSearchFilterResponse,
  createMessageReceivedEvent,
  createCrmEntityPersistencePlan,
  createOpenAiCrmEntityExtractor,
  createOpenAiCrmOrchestrator,
  createLeadReminderDraft,
  createReminderHistorySummary,
  decideIncomingLeadMatch,
  decideLeadFlow,
  isLeadInteractionNoteCommand,
  isLeadNaturalContextNote,
  isReminderRequest,
  routeCrmOrchestratorRequest,
  type AssistantAuditEventDraft,
  type AssistantChannelEvent,
  type AssistantChannelMessage,
  type CrmEntityExtractorClient,
  type CrmOrchestratorDecision,
  type CrmOrchestratorClient,
  type LeadSearchRecord
} from "@app/assistant";
import { getNextBusinessId } from "@app/core";
import { createObjectStorageFromEnv, type ObjectStorage } from "@app/core/storage";
import {
  createAssistantGeneratedDocumentPrismaStore,
  createAssistantPrismaRepository,
  createCrmEntityPrismaStore,
  createWorkspaceAiSettingPrismaStore,
  prisma as defaultPrisma
} from "@app/db";
import type { SaveLeadEntityExtractionInput, WorkspaceAiSettingRecord, WorkspaceAiSettingStore } from "@app/db";
import { createLibreOfficeDocxToPdfConverter } from "@app/documents";
import { loadRootEnv } from "../env/root-env";
import { createOpenAiAudioTranscriber, type TelegramAudioTranscriber } from "./openai-audio-transcriber";
import { syncEventToGoogleCalendar, type CalendarSyncResult } from "../google/calendar";
import {
  createLeadDraftFromTelegramMessage,
  createOpenAiLeadParserClient,
  createTelegramSourceExternalIds,
  type OpenAiLeadParserClient,
  type TelegramLeadAttachment,
  type TelegramLeadMessage
} from "./openai-lead-parser";
import {
  answerTelegramCallbackQuery,
  createAllowedTelegramMessages,
  fetchTelegramUpdates,
  parseAllowedChatIds,
  sendTelegramDocument,
  sendTelegramMessage,
  setTelegramBotCommands,
  type AllowedTelegramMessage,
  type TelegramPendingAttachment,
  type TelegramUpdate
} from "./telegram-polling";
import {
  createMemoryTelegramLeadDraftSessionStore,
  createTelegramLeadDraftSession,
  getKpRequiredFieldStatus,
  isPossibleDifferentLead,
  mergeTelegramLeadDraftSession,
  type KpRequiredField,
  type TelegramLeadDraftSession,
  type TelegramLeadDraftSessionStore
} from "./telegram-lead-draft-session";

export type TelegramWorkerPrismaLike = {
  attachment?: {
    create(args: unknown): Promise<{ id: string }>;
  };
  lead: {
    findMany(
      args: unknown
    ): Promise<
      Array<{
        id?: string;
        leadId: string;
        status?: string | null;
        rawInput: string | null;
        createdDate?: Date | string | null;
        temperature?: string | null;
        requestType?: string | null;
        projectAddress?: string | null;
        displayName?: string | null;
        searchTags?: unknown;
        clientRecordId?: string | null;
        client?: { name?: string | null; email?: string | null; phone?: string | null } | null;
        clientName?: string | null;
        bgfM2?: number | null;
        email?: string | null;
        phone?: string | null;
        missingData?: string[] | null;
        kpSentDate?: Date | string | null;
      }>
    >;
    create(args: unknown): Promise<{ id?: string; leadId: string; status: string }>;
    update?(args: unknown): Promise<{ id?: string; leadId: string; status: string }>;
    delete?(args: unknown): Promise<unknown>;
  };
  leadContextEntity?: {
    deleteMany(args: unknown): Promise<{ count: number }>;
  };
  crmCalendarAction?: {
    deleteMany(args: unknown): Promise<{ count: number }>;
  };
  auditLog?: {
    findMany(args: unknown): Promise<Array<{ targetId?: string | null; metadata?: unknown; createdAt?: Date | string }>>;
  };
};

export type TelegramGenerateKpDocumentInput = {
  workspaceId: string;
  documentId: string;
  documentType: "kp";
  sourceRecordIds: string[];
  rawInput: string;
  fieldSnapshot?: {
    clientName?: string | null;
    requestType?: string | null;
    projectAddress?: string | null;
    bgfM2?: number | null;
    email?: string | null;
    phone?: string | null;
    missingData?: string[];
  };
  requestedByUserId: string;
};

export type TelegramGeneratedKpDocumentRecord = TelegramGenerateKpDocumentInput & {
  id: string;
  docxAttachmentId?: string;
  docxDeliveryUrl?: string;
  pdfAttachmentId?: string;
  pdfDeliveryUrl?: string;
};

export type TelegramSourceAttachmentInput = {
  workspaceId: string;
  chatId: string;
  messageId: number;
  fileId: string;
  kind: TelegramLeadAttachment["kind"];
  fileName: string;
  mimeType: string;
  body: Uint8Array;
  receivedAt: string;
  requestedByUserId: string;
};

export type TelegramSourceAttachmentRecord = {
  attachmentId: string;
  storageKey: string;
};

export type TelegramWorkerConfig = {
  allowedChatIds: Set<string>;
  botToken: string;
  workspaceId: string;
  parser: OpenAiLeadParserClient;
  crmBaseUrl?: string;
  batchWindowMs?: number;
  kpRequiredFields?: KpRequiredField[];
  telegramDraftStore?: TelegramLeadDraftSessionStore;
  generateKpDocument?: (input: TelegramGenerateKpDocumentInput) => Promise<TelegramGeneratedKpDocumentRecord>;
  saveAuditEvent?: (event: AssistantAuditEventDraft) => void | Promise<void>;
  saveSourceAttachment?: (input: TelegramSourceAttachmentInput) => Promise<TelegramSourceAttachmentRecord>;
  audioTranscriber?: TelegramAudioTranscriber;
  crmOrchestrator?: CrmOrchestratorClient;
  crmEntityExtractor?: CrmEntityExtractorClient;
  saveLeadEntityExtraction?: (input: SaveLeadEntityExtractionInput) => Promise<void>;
  prisma?: TelegramWorkerPrismaLike;
  fetchImpl?: typeof fetch;
};

export type TelegramWorkerResult = {
  processed: number;
  ignored: number;
  lastUpdateId?: number;
};

export type TelegramWorkerLoopResult = {
  iterations: number;
  processed: number;
  ignored: number;
};

export type TelegramWorkerLoopConfig = {
  intervalMs?: number;
  maxIterations?: number;
  runOnce: (iteration: number) => Promise<TelegramWorkerResult>;
  sleep?: (intervalMs: number) => Promise<void>;
  onResult?: (result: TelegramWorkerResult, iteration: number) => void;
};

type TelegramGetFileResponse = {
  ok: boolean;
  result?: {
    file_path?: string;
  };
};

type TelegramTestEnv = {
  TELEGRAM_TEST_MESSAGE?: string;
  TELEGRAM_TEST_CHAT_ID?: string;
  TELEGRAM_TEST_MESSAGE_ID?: string;
  TELEGRAM_TEST_RECEIVED_AT?: string;
};

type AllowedTelegramMessageBatch = AllowedTelegramMessage & {
  sourceMessageIds: number[];
  updateIds: number[];
};

type AllowedTelegramLeadActionCallback = {
  updateId: number;
  callbackQueryId: string;
  chatId: string;
  messageId?: number;
  receivedAt: string;
  action:
    | "mark_kp_sent"
    | "undo_kp_sent"
    | "undo_lead_action"
    | "recreate_lead_from_undo"
    | "open_lead_card"
    | "search_next";
  leadId?: string;
  actionId?: string;
  offset?: number;
};

type TelegramLeadRecordCallback = AllowedTelegramLeadActionCallback & { leadId: string };
type TelegramSearchNextCallback = AllowedTelegramLeadActionCallback & { action: "search_next"; offset: number };

type TelegramSourceAttachmentPrismaLike = {
  attachment?: {
    create(args: unknown): Promise<{ id: string }>;
  };
};

let defaultTelegramDraftStore = createMemoryTelegramLeadDraftSessionStore();
const telegramUndoActionMemory = new Map<string, TelegramLeadUndoActionRecord>();
const telegramCompletedUndoActionMemory = new Map<string, TelegramLeadUndoActionRecord>();
const telegramUndoneActionMemory = new Set<string>();
const telegramSearchModeMemory = new Set<string>();
const telegramBotCommandMenuMemory = new Set<string>();
const TELEGRAM_BOT_COMMANDS = [
  { command: "newlead", description: "new lead" },
  { command: "searchlead", description: "search lead" }
];

type TelegramLeadUndoActionType = "create_lead" | "update_lead";

type TelegramLeadUndoActionRecord = {
  id: string;
  workspaceId: string;
  chatId: string;
  actionId: string;
  leadId: string;
  actionType: TelegramLeadUndoActionType;
  leadRecordId?: string;
  before?: Record<string, unknown>;
  draftSnapshot?: Awaited<ReturnType<typeof createLeadDraftFromTelegramMessage>>;
  sourceText: string;
  sourceMessageIds: number[];
  createdAt: string;
};

export function resetTelegramWorkerMemoryForTests(): void {
  defaultTelegramDraftStore = createMemoryTelegramLeadDraftSessionStore();
  telegramUndoActionMemory.clear();
  telegramCompletedUndoActionMemory.clear();
  telegramUndoneActionMemory.clear();
  telegramSearchModeMemory.clear();
  telegramBotCommandMenuMemory.clear();
}

export function createTelegramTestUpdateFromEnv(env: TelegramTestEnv): TelegramUpdate | undefined {
  const text = env.TELEGRAM_TEST_MESSAGE?.trim();

  if (!text) {
    return undefined;
  }

  const messageId = Number(env.TELEGRAM_TEST_MESSAGE_ID ?? "1");
  const chatId = Number(env.TELEGRAM_TEST_CHAT_ID ?? "1");
  const receivedAt = env.TELEGRAM_TEST_RECEIVED_AT ?? new Date().toISOString();

  return {
    update_id: Number.isFinite(messageId) ? messageId : 1,
    message: {
      message_id: Number.isFinite(messageId) ? messageId : 1,
      date: Math.floor(new Date(receivedAt).getTime() / 1000),
      chat: { id: Number.isFinite(chatId) ? chatId : 1 },
      text
    }
  };
}

export async function processTelegramUpdates(updates: TelegramUpdate[], config: TelegramWorkerConfig): Promise<TelegramWorkerResult> {
  const client = (config.prisma ?? defaultPrisma) as TelegramWorkerPrismaLike;
  const fetchImpl = config.fetchImpl ?? fetch;
  const telegramDraftStore = config.telegramDraftStore ?? defaultTelegramDraftStore;
  const allowedCallbacks = createAllowedTelegramLeadActionCallbacks(updates, config.allowedChatIds);
  const allowedMessages = createAllowedTelegramMessages(updates, config.allowedChatIds);
  const messageBatches = createAllowedTelegramMessageBatches(allowedMessages, config.batchWindowMs);
  let processed = 0;
  let skipped = 0;

  for (const callback of allowedCallbacks) {
    if (isTelegramSearchNextCallback(callback)) {
      await processTelegramSearchNextCallback({ callback, config, client, fetchImpl });
      processed += 1;
      continue;
    }

    if (callback.action === "undo_lead_action" && isTelegramLeadRecordCallback(callback)) {
      await processTelegramLeadUndoCallback({ callback, config, client, fetchImpl });
      processed += 1;
      continue;
    }

    if (callback.action === "recreate_lead_from_undo" && isTelegramLeadRecordCallback(callback)) {
      await processTelegramLeadRecreateCallback({ callback, config, client, fetchImpl });
      processed += 1;
      continue;
    }

    if (callback.action === "open_lead_card" && isTelegramLeadRecordCallback(callback)) {
      await processTelegramLeadOpenCallback({ callback, config, client, fetchImpl });
      processed += 1;
      continue;
    }

    await safeAnswerTelegramCallbackQuery({
      botToken: config.botToken,
      callbackQueryId: callback.callbackQueryId,
      text: createTelegramLimitedActionsText(),
      fetchImpl
    });
    skipped += 1;
  }

  for (const message of messageBatches) {
    let telegramReplySent = false;
    let processingAcknowledgementSent = false;
    const sendWorkerTelegramMessage: typeof sendTelegramMessage = async (input) => {
      const sent = await sendTelegramMessage(input);
      telegramReplySent = true;
      return sent;
    };

    try {
    if (isTelegramLeadUndoClarificationRequest(message)) {
      await sendWorkerTelegramMessage({
        botToken: config.botToken,
        chatId: message.chatId,
        text: createTelegramLeadUndoClarificationMessage(),
        fetchImpl
      });
      skipped += message.sourceMessageIds.length;
      continue;
    }

    if (isTelegramSearchModeStartCommand(message)) {
      telegramSearchModeMemory.add(createTelegramSearchModeKey(config.workspaceId, message.chatId));
      const searchModeResponse = await createTelegramSearchModeStartedResponse(config, client);
      await sendWorkerTelegramMessage({
        botToken: config.botToken,
        chatId: message.chatId,
        text: searchModeResponse.text,
        parseMode: "HTML",
        replyMarkup: createTelegramResponseReplyMarkup(searchModeResponse.buttons, config.crmBaseUrl),
        fetchImpl
      });
      skipped += message.sourceMessageIds.length;
      continue;
    }

    const leadFlowDecision = decideLeadFlow(createTelegramAssistantChannelMessage(config.workspaceId, message));
    const forceCreateLeadFromCommand =
      leadFlowDecision.kind === "start_draft" &&
      leadFlowDecision.source === "new_lead_command" &&
      !isBareTelegramNewLeadCommand(message.text);

    if (leadFlowDecision.kind === "start_draft" && leadFlowDecision.source === "new_lead_command" && !forceCreateLeadFromCommand) {
      telegramSearchModeMemory.delete(createTelegramSearchModeKey(config.workspaceId, message.chatId));
      const session = createTelegramLeadDraftSession({
        chatId: message.chatId,
        workspaceId: config.workspaceId,
        receivedAt: message.receivedAt,
        sourceMessageIds: message.sourceMessageIds,
        draft: createEmptyTelegramLeadDraft(message)
      });
      const sent = await sendWorkerTelegramMessage({
        botToken: config.botToken,
        chatId: message.chatId,
        text: createTelegramNewLeadStartedMessage(session),
        fetchImpl
      });
      await telegramDraftStore.save({ ...session, telegramDraftMessageId: sent.messageId });
      skipped += message.sourceMessageIds.length;
      continue;
    }

    if (isTelegramStartRequest(message)) {
      await sendWorkerTelegramMessage({
        botToken: config.botToken,
        chatId: message.chatId,
        text: createTelegramSharedHelpMessage(config.workspaceId, message.chatId, "/start"),
        fetchImpl
      });
      skipped += message.sourceMessageIds.length;
      continue;
    }

    if (isTelegramHelpRequest(message)) {
      await sendWorkerTelegramMessage({
        botToken: config.botToken,
        chatId: message.chatId,
        text: createTelegramSharedHelpMessage(config.workspaceId, message.chatId, "/help"),
        fetchImpl
      });
      skipped += message.sourceMessageIds.length;
      continue;
    }

    if (isTelegramSearchCapabilityQuestion(message)) {
      await sendWorkerTelegramMessage({
        botToken: config.botToken,
        chatId: message.chatId,
        text: createTelegramSearchCapabilityMessage(),
        fetchImpl
      });
      skipped += message.sourceMessageIds.length;
      continue;
    }

    const sourceExternalIds = createTelegramSourceExternalIds(message);
    await saveTelegramChannelEvent(
      config,
      message,
      createMessageReceivedEvent({
        type: "message_received",
        channel: "telegram",
        threadId: createTelegramThreadId(message.chatId),
        messageId: String(message.messageId),
        summary: message.text
      })
    );
    const repliedLead =
      (message.replyToMessageId ? await findLeadByTelegramReplyContext(client, config.workspaceId, message) : null) ??
      (await findLeadByTelegramTextContext(client, config.workspaceId, message.text));
    const replyLeadFlowDecision = repliedLead
      ? decideLeadFlow(
          createTelegramAssistantChannelMessage(config.workspaceId, message, {
            leadId: repliedLead.leadId,
            sourceMessageId: String(message.replyToMessageId ?? message.messageId)
          })
        )
      : null;

    if (
      repliedLead &&
      message.replyToMessageId === undefined &&
      (isLeadInteractionNoteCommand(message.text) || isReminderRequest(message.text) || isLeadNaturalContextNote(message.text))
    ) {
      await sendWorkerTelegramMessage({
        botToken: config.botToken,
        chatId: message.chatId,
        text: createTelegramLeadCardMessage(repliedLead),
        parseMode: "HTML",
        replyMarkup: createTelegramCrmOnlyReplyMarkup(config.crmBaseUrl, repliedLead.leadId),
        fetchImpl
      });
      skipped += message.sourceMessageIds.length;
      continue;
    }

    if (repliedLead && message.replyToMessageId !== undefined && (isLeadInteractionNoteCommand(message.text) || isReminderRequest(message.text) || isLeadNaturalContextNote(message.text))) {
      const isExplicitNote = isLeadInteractionNoteCommand(message.text);
      const isReminder = !isExplicitNote && isReminderRequest(message.text);
      const summary = isExplicitNote
        ? createLeadInteractionNoteSummary(message.text)
        : isReminder
          ? createReminderHistorySummary(message.text, { now: new Date(message.receivedAt) })
          : createLeadNaturalContextSummary(message.text);
      const reminderDraft = isReminder ? createLeadReminderDraft(message.text, { now: new Date(message.receivedAt) }) : null;

      if (reminderDraft?.calendarStatus === "needs_date") {
        await sendWorkerTelegramMessage({
          botToken: config.botToken,
          chatId: message.chatId,
          text: `I can create a reminder for lead <b>${escapeHtml(repliedLead.leadId)}</b>, but I need a date or time. For example: "remind me tomorrow to call the client".`,
          parseMode: "HTML",
          replyMarkup: createTelegramCrmOnlyReplyMarkup(config.crmBaseUrl, repliedLead.leadId),
          fetchImpl
        });
        processed += 1;
        continue;
      }

      if (reminderDraft?.dueAt && client.lead.update && repliedLead.id) {
        await client.lead.update({
          where: { id: repliedLead.id },
          data: {
            followup1Date: reminderDraft.dueAt,
            followupStatus: "planned"
          }
        });
      }
      const calendarSync = reminderDraft?.dueAt
        ? await trySyncTelegramReminderToCalendar({
            workspaceId: config.workspaceId,
            leadId: repliedLead.leadId,
            dueAt: reminderDraft.dueAt,
            summary
          })
        : null;

      await saveTelegramChannelEvent(
        config,
        message,
        createLeadInteractionNoteEvent({
          type: "lead_interaction_note",
          channel: "telegram",
          threadId: createTelegramThreadId(message.chatId),
          leadId: repliedLead.leadId,
          messageId: String(message.messageId),
          summary
        })
      );
      await sendWorkerTelegramMessage({
        botToken: config.botToken,
        chatId: message.chatId,
        text: createTelegramLeadHistoryUpdatedMessage(repliedLead.leadId, summary, calendarSync),
        parseMode: "HTML",
        replyMarkup: createTelegramCrmOnlyReplyMarkup(config.crmBaseUrl, repliedLead.leadId),
        fetchImpl
      });
      processed += 1;
      continue;
    }

    const searchFilterResponse = await createTelegramSearchFilterResponse(config, client, message);
    if (searchFilterResponse) {
      await sendWorkerTelegramMessage({
        botToken: config.botToken,
        chatId: message.chatId,
        text: searchFilterResponse.text,
        parseMode: "HTML",
        replyMarkup: createTelegramResponseReplyMarkup(searchFilterResponse.buttons, config.crmBaseUrl),
        fetchImpl
      });
      skipped += message.sourceMessageIds.length;
      continue;
    }

    if (!forceCreateLeadFromCommand) {
      const generalAssistantResponse = createTelegramGeneralAssistantResponse(
        config.workspaceId,
        message,
        repliedLead ? { leadId: repliedLead.leadId, sourceMessageId: String(message.replyToMessageId ?? message.messageId) } : undefined
      );
      if (generalAssistantResponse) {
        const responseText =
          !repliedLead && generalAssistantResponse.intent === "crm_action" && isReminderRequest(message.text)
            ? createTelegramLimitedActionsText()
            : generalAssistantResponse.text;
        await sendWorkerTelegramMessage({
          botToken: config.botToken,
          chatId: message.chatId,
          text: responseText,
          replyMarkup: createTelegramResponseReplyMarkup(generalAssistantResponse.buttons, config.crmBaseUrl),
          fetchImpl
        });
        skipped += message.sourceMessageIds.length;
        continue;
      }

      const crmOrchestratorFallbackResponse = await createTelegramCrmOrchestratorFallbackResponse(
        config,
        message,
        repliedLead ? { leadId: repliedLead.leadId, sourceMessageId: String(message.replyToMessageId ?? message.messageId) } : undefined
      );
      if (crmOrchestratorFallbackResponse) {
        await sendWorkerTelegramMessage({
          botToken: config.botToken,
          chatId: message.chatId,
          text: crmOrchestratorFallbackResponse.text,
          replyMarkup: createTelegramResponseReplyMarkup(crmOrchestratorFallbackResponse.buttons, config.crmBaseUrl),
          fetchImpl
        });
        skipped += message.sourceMessageIds.length;
        continue;
      }
    }

    if (repliedLead && isTelegramKpSentCommand(message) && !isTelegramKpSentUndoCommand(message)) {
      await sendWorkerTelegramMessage({
        botToken: config.botToken,
        chatId: message.chatId,
        text: createTelegramLimitedActionsText(repliedLead.leadId),
        parseMode: "HTML",
        fetchImpl
      });
      skipped += message.sourceMessageIds.length;
      continue;
    }

    if (repliedLead && isTelegramKpSentUndoCommand(message)) {
      await sendWorkerTelegramMessage({
        botToken: config.botToken,
        chatId: message.chatId,
        text: createTelegramLimitedActionsText(repliedLead.leadId),
        parseMode: "HTML",
        fetchImpl
      });
      skipped += message.sourceMessageIds.length;
      continue;
    }

    if (repliedLead && replyLeadFlowDecision?.kind === "not_lead_flow") {
      const response = createAssistantChannelResponse(
        createTelegramAssistantChannelMessage(config.workspaceId, message, {
          leadId: repliedLead.leadId,
          sourceMessageId: String(message.replyToMessageId ?? message.messageId)
        })
      );
      await sendWorkerTelegramMessage({
        botToken: config.botToken,
        chatId: message.chatId,
        text: response.text,
        replyMarkup: createTelegramResponseReplyMarkup(response.buttons, config.crmBaseUrl),
        fetchImpl
      });
      skipped += message.sourceMessageIds.length;
      continue;
    }

    const existingLeads = await client.lead.findMany({
      where: {
        workspaceId: config.workspaceId,
        OR: sourceExternalIds.map((sourceExternalId) => ({
          rawInput: { contains: sourceExternalId }
        }))
      },
      select: { leadId: true, rawInput: true }
    });

    const exactSourceMatch = decideIncomingLeadMatch({
      incoming: {
        rawInput: message.text,
        sourceExternalIds
      },
      candidates: existingLeads
    });

    if (exactSourceMatch.kind === "exact_duplicate") {
      await sendWorkerTelegramMessage({
        botToken: config.botToken,
        chatId: message.chatId,
        text: `Lead <b>${escapeHtml(exactSourceMatch.leadId)}</b> already exists. Open it in CRM to check the saved data.`,
        parseMode: "HTML",
        replyMarkup: createTelegramCrmOnlyReplyMarkup(config.crmBaseUrl, exactSourceMatch.leadId),
        fetchImpl
      });
      skipped += message.sourceMessageIds.length;
      continue;
    }

    processingAcknowledgementSent = await sendTelegramProcessingAcknowledgement({
      botToken: config.botToken,
      chatId: message.chatId,
      message,
      fetchImpl
    });

    const hydratedMessage = await hydrateTelegramLeadMessage(message, config);
    if (hasAudioTranscriptionFailure(hydratedMessage)) {
      await sendWorkerTelegramMessage({
        botToken: config.botToken,
        chatId: message.chatId,
        text: createTelegramAudioTranscriptionFailureMessage(),
        fetchImpl
      });
      skipped += message.sourceMessageIds.length;
      continue;
    }

    const existingIds = await client.lead.findMany({
      where: { workspaceId: config.workspaceId },
      select: {
        id: true,
        leadId: true,
        status: true,
        rawInput: true,
        requestType: true,
        projectAddress: true,
        bgfM2: true,
        missingData: true,
        client: {
          select: {
            name: true,
            email: true,
            phone: true
          }
        }
      }
    });
    let draft: Awaited<ReturnType<typeof createLeadDraftFromTelegramMessage>>;
    try {
      draft = await createLeadDraftFromTelegramMessage(hydratedMessage, config.parser);
    } catch (error) {
      console.warn(error instanceof Error ? error.message : error);
      if (processingAcknowledgementSent) {
        await sendTelegramServerErrorFallbackMessage({
          botToken: config.botToken,
          chatId: message.chatId,
          processingMaterials: true,
          fetchImpl
        });
      } else {
        await sendWorkerTelegramMessage({
          botToken: config.botToken,
          chatId: message.chatId,
          text: createTelegramLeadParseFailureMessage(),
          fetchImpl
        });
      }
      skipped += message.sourceMessageIds.length;
      continue;
    }

    if (!repliedLead && shouldAskClarifyingQuestionForAudio(draft, hydratedMessage)) {
      await sendWorkerTelegramMessage({
        botToken: config.botToken,
        chatId: message.chatId,
        text: createTelegramAmbiguousAudioClarificationMessage(),
        fetchImpl
      });
      skipped += message.sourceMessageIds.length;
      continue;
    }

    if (repliedLead) {
      if (!client.lead.update || !repliedLead.id) {
        await sendWorkerTelegramMessage({
          botToken: config.botToken,
          chatId: message.chatId,
          text: `I found lead <b>${escapeHtml(repliedLead.leadId)}</b>, but I cannot update it from this worker yet.`,
          parseMode: "HTML",
          fetchImpl
        });
        skipped += message.sourceMessageIds.length;
        continue;
      }

      if (isPossibleDifferentLead(createTelegramLeadSessionFromExistingLead(repliedLead, message), draft)) {
        await sendWorkerTelegramMessage({
          botToken: config.botToken,
          chatId: message.chatId,
          text: createTelegramLeadUpdateClarificationMessage(repliedLead, draft),
          parseMode: "HTML",
          fetchImpl
        });
        skipped += message.sourceMessageIds.length;
        continue;
      }

      const updateUndoAction = createTelegramLeadUndoActionRecord({
        config,
        message,
        leadId: repliedLead.leadId,
        leadRecordId: repliedLead.id,
        actionType: "update_lead",
        before: createTelegramLeadRestoreSnapshot(repliedLead),
        draftSnapshot: draft
      });
      await client.lead.update({
        where: { id: repliedLead.id },
        data: createTelegramLeadUpdateData(repliedLead, draft, message)
      });
      await saveTelegramLeadUndoAction(config, updateUndoAction);
      await saveTelegramLeadEntityExtraction(config, message, repliedLead, draft.rawInput);
      await saveTelegramChannelEvent(
        config,
        message,
        createLeadDraftUpdatedEvent({
          type: "lead_draft_updated",
          channel: "telegram",
          threadId: createTelegramThreadId(message.chatId),
          leadId: repliedLead.leadId,
          fieldsChanged: createDetectedTelegramLeadFields(draft),
          missingData: draft.missingData
        })
      );
      await saveTelegramChannelEvent(
        config,
        message,
        createLeadInteractionNoteEvent({
          type: "lead_interaction_note",
          channel: "telegram",
          threadId: createTelegramThreadId(message.chatId),
          leadId: repliedLead.leadId,
          messageId: String(message.messageId),
          summary: createTelegramInteractionSummary(message.text, createDetectedTelegramLeadFields(draft))
        })
      );
      await sendWorkerTelegramMessage({
        botToken: config.botToken,
        chatId: message.chatId,
        text: createTelegramLeadUpdatedMessage(repliedLead.leadId, draft),
        parseMode: "HTML",
        replyMarkup: createTelegramCrmReplyMarkup(config.crmBaseUrl, repliedLead.leadId, {
          email: draft.email,
          missingFields: draft.missingData,
          undoActionId: updateUndoAction.actionId
        }),
        fetchImpl
      });
      processed += 1;
      continue;
    }

    const replySession = message.replyToMessageId
      ? await telegramDraftStore.getByTelegramMessage?.({
          workspaceId: config.workspaceId,
          chatId: message.chatId,
          messageId: message.replyToMessageId
        })
      : null;
    let activeSession = replySession ?? (await telegramDraftStore.getActive({ workspaceId: config.workspaceId, chatId: message.chatId }));

    if (forceCreateLeadFromCommand && activeSession) {
      await telegramDraftStore.clear({ workspaceId: config.workspaceId, chatId: message.chatId });
      activeSession = null;
    }

    if (!activeSession && !forceCreateLeadFromCommand) {
      const persistedLeadMatch = decideIncomingLeadMatch({
        incoming: {
          rawInput: draft.rawInput,
          sourceExternalIds,
          clientName: draft.clientName,
          projectAddress: draft.projectAddress,
          email: draft.email,
          phone: draft.phone
        },
        candidates: existingIds.map((lead) => ({
          leadId: lead.leadId,
          rawInput: lead.rawInput,
          clientName: getLeadClientName(lead),
          projectAddress: lead.projectAddress,
          email: getLeadEmail(lead),
          phone: getLeadPhone(lead)
        }))
      });

      if (persistedLeadMatch.kind === "likely_update") {
        const lead = existingIds.find((item) => item.leadId === persistedLeadMatch.leadId);
        if (!client.lead.update || !lead?.id) {
          await sendWorkerTelegramMessage({
            botToken: config.botToken,
            chatId: message.chatId,
            text: `I found lead <b>${escapeHtml(persistedLeadMatch.leadId)}</b>, but I cannot update it from this worker yet.`,
            parseMode: "HTML",
            fetchImpl
          });
          skipped += message.sourceMessageIds.length;
          continue;
        }

        const fieldsChanged = createDetectedTelegramLeadFields(draft);
        const updateUndoAction = createTelegramLeadUndoActionRecord({
          config,
          message,
          leadId: lead.leadId,
          leadRecordId: lead.id,
          actionType: "update_lead",
          before: createTelegramLeadRestoreSnapshot(lead),
          draftSnapshot: draft
        });
        await client.lead.update({
          where: { id: lead.id },
          data: createTelegramLeadUpdateData(lead, draft, message)
        });
        await saveTelegramLeadUndoAction(config, updateUndoAction);
        await saveTelegramLeadEntityExtraction(config, message, lead, draft.rawInput);
        await saveTelegramChannelEvent(
          config,
          message,
          createLeadDraftUpdatedEvent({
            type: "lead_draft_updated",
            channel: "telegram",
            threadId: createTelegramThreadId(message.chatId),
            leadId: lead.leadId,
            fieldsChanged,
            missingData: draft.missingData
          })
        );
        await saveTelegramChannelEvent(
          config,
          message,
          createLeadInteractionNoteEvent({
            type: "lead_interaction_note",
            channel: "telegram",
            threadId: createTelegramThreadId(message.chatId),
            leadId: lead.leadId,
            messageId: String(message.messageId),
            summary: createTelegramInteractionSummary(message.text, fieldsChanged)
          })
        );
        await sendWorkerTelegramMessage({
          botToken: config.botToken,
          chatId: message.chatId,
          text: createTelegramLeadUpdatedMessage(lead.leadId, draft),
          parseMode: "HTML",
          replyMarkup: createTelegramCrmReplyMarkup(config.crmBaseUrl, lead.leadId, {
            email: draft.email,
            missingFields: draft.missingData,
            undoActionId: updateUndoAction.actionId
          }),
          fetchImpl
        });
        processed += 1;
        continue;
      }

      if (persistedLeadMatch.kind === "needs_clarification") {
        await sendWorkerTelegramMessage({
          botToken: config.botToken,
          chatId: message.chatId,
          text: createTelegramExistingLeadClarificationMessage(persistedLeadMatch.leadId, persistedLeadMatch.matchedFields),
          parseMode: "HTML",
          replyMarkup: createTelegramCrmOnlyReplyMarkup(config.crmBaseUrl, persistedLeadMatch.leadId),
          fetchImpl
        });
        skipped += message.sourceMessageIds.length;
        continue;
      }
    }

    if (activeSession && !replySession && !forceCreateLeadFromCommand && isPossibleDifferentLead(activeSession, draft)) {
      await sendWorkerTelegramMessage({
        botToken: config.botToken,
        chatId: message.chatId,
        text: createTelegramPossibleDifferentLeadMessage(activeSession, draft),
        fetchImpl
      });
      skipped += message.sourceMessageIds.length;
      continue;
    }

    let session = activeSession
      ? mergeTelegramLeadDraftSession(activeSession, draft, {
          receivedAt: hydratedMessage.receivedAt,
          sourceMessageIds: message.sourceMessageIds
        })
      : createTelegramLeadDraftSession({
          chatId: message.chatId,
          workspaceId: config.workspaceId,
          receivedAt: hydratedMessage.receivedAt,
          sourceMessageIds: message.sourceMessageIds,
          draft
        });
    const kpStatus = getKpRequiredFieldStatus(session.draft, config.kpRequiredFields);

    if (activeSession?.leadId) {
      const templateAwareMissingData = filterMissingDataForKpRequiredFields(session.draft.missingData, config.kpRequiredFields);
      const updateUndoAction = createTelegramLeadUndoActionRecord({
        config,
        message,
        leadId: activeSession.leadId,
        actionType: "update_lead",
        before: {
          status: "needs_data",
          rawInput: activeSession.draft.rawInput ?? null,
          requestType: activeSession.draft.requestType ?? null,
          projectAddress: activeSession.draft.projectAddress ?? null,
          bgfM2: activeSession.draft.bgfM2 ?? null,
          missingData: activeSession.draft.missingData ?? []
        },
        draftSnapshot: { ...session.draft, missingData: templateAwareMissingData }
      });
      try {
        const updated = client.lead.update
          ? await client.lead.update({
              where: {
                workspaceId_leadId: {
                  workspaceId: config.workspaceId,
                  leadId: activeSession.leadId
                }
              },
              data: {
                ...createTelegramLeadUpdateData(
                  { leadId: activeSession.leadId, status: "needs_data", rawInput: activeSession.draft.rawInput, missingData: activeSession.draft.missingData },
                  { ...session.draft, missingData: templateAwareMissingData },
                  message
                ),
                rawInput: session.draft.rawInput
              }
            })
          : { leadId: activeSession.leadId, status: templateAwareMissingData.length > 0 ? "needs_data" : "new" };
        if (client.lead.update) {
          await saveTelegramLeadUndoAction(config, updateUndoAction);
        }
        const sent = await sendWorkerTelegramMessage({
          botToken: config.botToken,
          chatId: message.chatId,
          text: createTelegramLeadUpdatedMessage(updated.leadId, { ...session.draft, missingData: templateAwareMissingData }),
          parseMode: "HTML",
          replyMarkup: createTelegramCrmReplyMarkup(config.crmBaseUrl, updated.leadId, {
            email: session.draft.email,
            missingFields: templateAwareMissingData,
            undoActionId: client.lead.update ? updateUndoAction.actionId : undefined
          }),
          fetchImpl
        });
        await saveTelegramLeadEntityExtraction(config, message, updated, session.draft.rawInput);
        if (templateAwareMissingData.length > 0) {
          await telegramDraftStore.save({ ...session, leadId: activeSession.leadId, telegramDraftMessageId: sent.messageId ?? session.telegramDraftMessageId });
        } else {
          await telegramDraftStore.clear({ workspaceId: config.workspaceId, chatId: message.chatId });
        }
        processed += 1;
        continue;
      } catch (error) {
        if (!isPrismaRecordNotFoundError(error)) {
          throw error;
        }
        console.warn(`Clearing stale Telegram draft session for missing lead ${activeSession.leadId}.`);
        await telegramDraftStore.clear({ workspaceId: config.workspaceId, chatId: message.chatId });
        activeSession = null;
        session = createTelegramLeadDraftSession({
          chatId: message.chatId,
          workspaceId: config.workspaceId,
          receivedAt: hydratedMessage.receivedAt,
          sourceMessageIds: message.sourceMessageIds,
          draft
        });
      }
    }

    if (!kpStatus.ready) {
      const leadId = getNextBusinessId({
        kind: "lead",
        now: new Date(hydratedMessage.receivedAt),
        existingIds: existingIds.map((lead) => lead.leadId)
      });
      const templateAwareMissingData = filterMissingDataForKpRequiredFields(session.draft.missingData, config.kpRequiredFields);
      const created = await client.lead.create({
        data: {
          workspaceId: config.workspaceId,
          leadId,
          status: "needs_data",
          rawInput: session.draft.rawInput,
          requestType: session.draft.requestType,
          projectAddress: session.draft.projectAddress,
          ...createTelegramLeadDisplayData(session.draft),
          bgfM2: session.draft.bgfM2,
          isStandard: session.draft.isStandard,
          missingData: templateAwareMissingData,
          temperature: session.draft.temperature === "unknown" ? "hot" : session.draft.temperature
        }
      });
      const createUndoAction = createTelegramLeadUndoActionRecord({
        config,
        message,
        leadId: created.leadId,
        leadRecordId: created.id,
        actionType: "create_lead",
        draftSnapshot: { ...session.draft, missingData: templateAwareMissingData }
      });
      await saveTelegramLeadUndoAction(config, createUndoAction);
      await saveTelegramChannelEvent(
        config,
        message,
        createLeadCreatedEvent({
          type: "lead_created",
          channel: "telegram",
          threadId: createTelegramThreadId(message.chatId),
          leadId: created.leadId,
          fieldsCreated: createDetectedTelegramLeadFields(session.draft),
          missingData: templateAwareMissingData
        })
      );
      await saveTelegramLeadEntityExtraction(config, message, created, session.draft.rawInput);
      const sent = await sendWorkerTelegramMessage({
        botToken: config.botToken,
        chatId: message.chatId,
        text: createTelegramLeadConfirmation({
          leadId: created.leadId,
          status: created.status,
          draft: { ...session.draft, missingData: templateAwareMissingData }
        }),
        parseMode: "HTML",
        replyMarkup: createTelegramCrmReplyMarkup(config.crmBaseUrl, created.leadId, {
          email: session.draft.email,
          missingFields: templateAwareMissingData,
          undoActionId: createUndoAction.actionId
        }),
        fetchImpl
      });
      if (client.lead.update && created.id && sent.messageId) {
        await client.lead.update({
          where: { id: created.id },
          data: {
            rawInput: appendTelegramBotLeadMessageMarker(session.draft.rawInput, message.chatId, sent.messageId)
          }
        });
      }
      await telegramDraftStore.save({ ...session, leadId: created.leadId, telegramDraftMessageId: sent.messageId ?? session.telegramDraftMessageId });
      processed += 1;
      continue;
    }

    const leadId = getNextBusinessId({
      kind: "lead",
      now: new Date(hydratedMessage.receivedAt),
      existingIds: existingIds.map((lead) => lead.leadId)
    });
    const templateAwareMissingData = filterMissingDataForKpRequiredFields(session.draft.missingData, config.kpRequiredFields);
    const created = await client.lead.create({
      data: {
        workspaceId: config.workspaceId,
        leadId,
        status: templateAwareMissingData.length > 0 ? "needs_data" : "new",
        rawInput: session.draft.rawInput,
        requestType: session.draft.requestType,
        projectAddress: session.draft.projectAddress,
        ...createTelegramLeadDisplayData(session.draft),
        bgfM2: session.draft.bgfM2,
        isStandard: session.draft.isStandard,
        missingData: templateAwareMissingData,
        temperature: session.draft.temperature === "unknown" ? "hot" : session.draft.temperature
      }
    });
    const createUndoAction = createTelegramLeadUndoActionRecord({
      config,
      message,
      leadId: created.leadId,
      leadRecordId: created.id,
      actionType: "create_lead",
      draftSnapshot: { ...session.draft, missingData: templateAwareMissingData }
    });
    await saveTelegramLeadUndoAction(config, createUndoAction);
    await saveTelegramChannelEvent(
      config,
      message,
      createLeadCreatedEvent({
        type: "lead_created",
        channel: "telegram",
        threadId: createTelegramThreadId(message.chatId),
        leadId: created.leadId,
        fieldsCreated: createDetectedTelegramLeadFields(session.draft),
        missingData: templateAwareMissingData
      })
    );
    await saveTelegramLeadEntityExtraction(config, message, created, session.draft.rawInput);
    let generatedDocument: TelegramGeneratedKpDocumentRecord | null = null;
    let generatedDocumentError: string | undefined;
    if (config.generateKpDocument) {
      try {
        generatedDocument = await config.generateKpDocument({
          workspaceId: config.workspaceId,
          documentId: createTelegramKpDocumentId(message),
          documentType: "kp",
          sourceRecordIds: [created.leadId],
          rawInput: session.draft.rawInput,
          fieldSnapshot: createTelegramKpFieldSnapshot({ ...session.draft, missingData: templateAwareMissingData }),
          requestedByUserId: `telegram:${message.chatId}`
        });
      } catch (error) {
        generatedDocumentError = createTelegramKpGenerationErrorMessage(error);
        console.warn(error instanceof Error ? error.message : error);
      }
    }
    if (generatedDocument && client.lead.update && created.id) {
      await client.lead.update({
        where: { id: created.id },
        data: { kpGeneratedDocumentId: generatedDocument.documentId }
      });
      await saveTelegramChannelEvent(
        config,
        message,
        createKpGeneratedEvent({
          type: "kp_generated",
          channel: "telegram",
          threadId: createTelegramThreadId(message.chatId),
          leadId: created.leadId,
          documentId: generatedDocument.documentId
        })
      );
    }
    const generatedDocumentPdfUrl =
      generatedDocument?.pdfDeliveryUrl ?? createTelegramAttachmentDeliveryUrl(config.crmBaseUrl, generatedDocument?.pdfAttachmentId);
    const generatedDocumentDocxUrl =
      generatedDocument?.docxDeliveryUrl ?? createTelegramAttachmentDeliveryUrl(config.crmBaseUrl, generatedDocument?.docxAttachmentId, true);
    const generatedDocumentDeliveryUrl = generatedDocumentPdfUrl ?? generatedDocumentDocxUrl;

    let generatedDocumentDelivered = false;
    if (generatedDocumentDeliveryUrl && generatedDocument) {
      try {
        await sendTelegramDocument({
          botToken: config.botToken,
          chatId: message.chatId,
          document: generatedDocumentDeliveryUrl,
          caption: `KP document ${generatedDocument.documentId} is ready.`,
          fetchImpl
        });
        generatedDocumentDelivered = true;
      } catch (error) {
        console.warn(error instanceof Error ? error.message : error);
      }
    }
    await telegramDraftStore.clear({ workspaceId: config.workspaceId, chatId: message.chatId });

    const finalMessage = await sendWorkerTelegramMessage({
      botToken: config.botToken,
      chatId: message.chatId,
      text: createTelegramLeadConfirmation({
        leadId: created.leadId,
        status: created.status,
        draft: session.draft,
        generatedDocumentId: generatedDocument?.documentId,
        generatedDocumentDelivered,
        generatedDocumentError
      }),
      parseMode: "HTML",
      replyMarkup: createTelegramCrmReplyMarkup(config.crmBaseUrl, created.leadId, {
        email: session.draft.email,
        pdfUrl: generatedDocumentPdfUrl,
        docxUrl: generatedDocumentDocxUrl,
        missingFields: templateAwareMissingData,
        undoActionId: createUndoAction.actionId
      }),
      fetchImpl
    });
    if (client.lead.update && created.id && finalMessage.messageId) {
      await client.lead.update({
        where: { id: created.id },
        data: {
          rawInput: appendTelegramBotLeadMessageMarker(session.draft.rawInput, message.chatId, finalMessage.messageId)
        }
      });
    }
    processed += 1;
    } catch (error) {
      console.warn(error instanceof Error ? error.message : error);
      if (!telegramReplySent) {
        await sendTelegramServerErrorFallbackMessage({
          botToken: config.botToken,
          chatId: message.chatId,
          processingMaterials: processingAcknowledgementSent,
          fetchImpl
        });
      }
      skipped += message.sourceMessageIds.length;
    }
  }

  return {
    processed,
    ignored: updates.length - allowedMessages.length + skipped,
    lastUpdateId: updates.length > 0 ? Math.max(...updates.map((update) => update.update_id)) : undefined
  };
}

function createTelegramCrmOnlyReplyMarkup(crmBaseUrl: string | undefined, leadId: string): unknown | undefined {
  if (!crmBaseUrl?.trim()) {
    return undefined;
  }

  return {
    inline_keyboard: [
      [
        {
          text: "CRM",
          url: `${crmBaseUrl.replace(/\/+$/, "")}/leads?leadId=${encodeURIComponent(leadId)}`
        }
      ]
    ]
  };
}

function createTelegramUndoOnlyReplyMarkup(leadId: string, actionId: string): unknown {
  return {
    inline_keyboard: [[{ text: "Undo", callback_data: createTelegramLeadUndoCallbackData(leadId, actionId) }]]
  };
}

async function safeAnswerTelegramCallbackQuery(config: Parameters<typeof answerTelegramCallbackQuery>[0]): Promise<void> {
  try {
    await answerTelegramCallbackQuery(config);
  } catch (error) {
    console.warn(error instanceof Error ? error.message : error);
  }
}

async function processTelegramLeadUndoCallback(input: {
  callback: TelegramLeadRecordCallback;
  config: TelegramWorkerConfig;
  client: TelegramWorkerPrismaLike;
  fetchImpl: typeof fetch;
}): Promise<void> {
  const { callback, config, client, fetchImpl } = input;
  await safeAnswerTelegramCallbackQuery({
    botToken: config.botToken,
    callbackQueryId: callback.callbackQueryId,
    text: "Undo requested.",
    fetchImpl
  });

  const record = await findTelegramLeadUndoAction(client, {
    workspaceId: config.workspaceId,
    chatId: callback.chatId,
    leadId: callback.leadId,
    actionId: callback.actionId,
    includeDone: true
  });

  if (!record) {
    await sendTelegramMessage({
      botToken: config.botToken,
      chatId: callback.chatId,
      text: `I could not find an undoable action for lead <b>${escapeHtml(callback.leadId)}</b>.`,
      parseMode: "HTML",
      replyMarkup: createTelegramCrmOnlyReplyMarkup(config.crmBaseUrl, callback.leadId),
      fetchImpl
    });
    return;
  }

  if (record.actionType === "create_lead") {
    const lead = await findLeadByLeadId(client, config.workspaceId, record.leadId);
    if (lead?.id) {
      await client.leadContextEntity?.deleteMany({ where: { workspaceId: config.workspaceId, leadRecordId: lead.id } });
      await client.crmCalendarAction?.deleteMany({ where: { workspaceId: config.workspaceId, leadRecordId: lead.id } });
      if (client.lead.delete) {
        await client.lead.delete({ where: { id: lead.id } });
      } else if (client.lead.update) {
        await client.lead.update({ where: { id: lead.id }, data: { status: "archived", archivedAt: new Date(callback.receivedAt) } });
      }
    }

    await markTelegramLeadUndoActionDone(config, record, { undone: true, mode: client.lead.delete ? "deleted" : "archived" });
    await sendTelegramMessage({
      botToken: config.botToken,
      chatId: callback.chatId,
      text: `Undo done. Lead <b>${escapeHtml(record.leadId)}</b> was ${client.lead.delete ? "removed" : "archived"}.`,
      parseMode: "HTML",
      fetchImpl
    });
    return;
  }

  const lead = await findLeadByLeadId(client, config.workspaceId, record.leadId);
  if (!lead?.id || !client.lead.update || !record.before) {
    await sendTelegramMessage({
      botToken: config.botToken,
      chatId: callback.chatId,
      text: `I found the undo action for <b>${escapeHtml(record.leadId)}</b>, but cannot restore it from this worker.`,
      parseMode: "HTML",
      replyMarkup: createTelegramCrmOnlyReplyMarkup(config.crmBaseUrl, record.leadId),
      fetchImpl
    });
    return;
  }

  await client.lead.update({
    where: { id: lead.id },
    data: record.before
  });
  await markTelegramLeadUndoActionDone(config, record, { undone: true, mode: "restored" });
  await sendTelegramMessage({
    botToken: config.botToken,
    chatId: callback.chatId,
    text: `Undo done. Lead <b>${escapeHtml(record.leadId)}</b> was restored to the previous state.`,
    parseMode: "HTML",
    replyMarkup: createTelegramUndoUpdateDoneReplyMarkup(config.crmBaseUrl, record),
    fetchImpl
  });
}

async function processTelegramLeadRecreateCallback(input: {
  callback: TelegramLeadRecordCallback;
  config: TelegramWorkerConfig;
  client: TelegramWorkerPrismaLike;
  fetchImpl: typeof fetch;
}): Promise<void> {
  const { callback, config, client, fetchImpl } = input;
  await safeAnswerTelegramCallbackQuery({
    botToken: config.botToken,
    callbackQueryId: callback.callbackQueryId,
    text: "Creating a new lead from the same source.",
    fetchImpl
  });

  const record = await findTelegramLeadUndoAction(client, {
    workspaceId: config.workspaceId,
    chatId: callback.chatId,
    leadId: callback.leadId,
    actionId: callback.actionId,
    includeDone: true
  });
  const draft = record?.draftSnapshot;
  if (!record || !draft) {
    await sendTelegramMessage({
      botToken: config.botToken,
      chatId: callback.chatId,
      text: "I could not recreate a new lead because the original source snapshot is missing.",
      fetchImpl
    });
    return;
  }

  const existingIds = await client.lead.findMany({
    where: { workspaceId: config.workspaceId },
    select: { leadId: true, rawInput: true }
  });
  const leadId = getNextBusinessId({
    kind: "lead",
    now: new Date(callback.receivedAt),
    existingIds: existingIds.map((lead) => lead.leadId)
  });
  const created = await client.lead.create({
    data: {
      workspaceId: config.workspaceId,
      leadId,
      status: (draft.missingData ?? []).length > 0 ? "needs_data" : "new",
      rawInput: draft.rawInput,
      requestType: draft.requestType,
      projectAddress: draft.projectAddress,
      ...createTelegramLeadDisplayData(draft),
      bgfM2: draft.bgfM2,
      isStandard: draft.isStandard,
      missingData: draft.missingData,
      temperature: draft.temperature === "unknown" ? "hot" : draft.temperature
    }
  });
  const createUndoAction = createTelegramLeadUndoActionRecord({
    config,
    message: {
      chatId: callback.chatId,
      messageId: callback.messageId ?? Number(record.actionId),
      text: record.sourceText,
      sourceMessageIds: record.sourceMessageIds,
      receivedAt: callback.receivedAt
    },
    leadId: created.leadId,
    leadRecordId: created.id,
    actionType: "create_lead",
    draftSnapshot: draft
  });
  await saveTelegramLeadUndoAction(config, createUndoAction);

  await sendTelegramMessage({
    botToken: config.botToken,
    chatId: callback.chatId,
    text: createTelegramLeadConfirmation({ leadId: created.leadId, status: created.status, draft }),
    parseMode: "HTML",
    replyMarkup: createTelegramCrmReplyMarkup(config.crmBaseUrl, created.leadId, {
      email: draft.email,
      missingFields: draft.missingData,
      undoActionId: createUndoAction.actionId
    }),
    fetchImpl
  });
}

async function processTelegramLeadOpenCallback(input: {
  callback: TelegramLeadRecordCallback;
  config: Pick<TelegramWorkerConfig, "botToken" | "workspaceId" | "crmBaseUrl">;
  client: TelegramWorkerPrismaLike;
  fetchImpl: typeof fetch;
}): Promise<void> {
  const lead = await findLeadByLeadId(input.client, input.config.workspaceId, input.callback.leadId);
  await safeAnswerTelegramCallbackQuery({
    botToken: input.config.botToken,
    callbackQueryId: input.callback.callbackQueryId,
    text: lead ? "Lead opened." : "Lead not found.",
    fetchImpl: input.fetchImpl
  });

  const sent = await sendTelegramMessage({
    botToken: input.config.botToken,
    chatId: input.callback.chatId,
    text: lead ? createTelegramLeadCardMessage(lead) : `Lead <b>${escapeHtml(input.callback.leadId)}</b> was not found in CRM.`,
    parseMode: "HTML",
    replyMarkup: lead ? createTelegramCrmOnlyReplyMarkup(input.config.crmBaseUrl, lead.leadId) : undefined,
    fetchImpl: input.fetchImpl
  });
  await saveTelegramLeadCardReplyContext(input.config, input.client, input.callback.chatId, lead, sent.messageId);
}

async function processTelegramSearchNextCallback(input: {
  callback: TelegramSearchNextCallback;
  config: Pick<TelegramWorkerConfig, "botToken" | "workspaceId" | "crmBaseUrl">;
  client: TelegramWorkerPrismaLike;
  fetchImpl: typeof fetch;
}): Promise<void> {
  const response = await createTelegramSearchModeStartedResponse(input.config, input.client, input.callback.offset);
  await safeAnswerTelegramCallbackQuery({
    botToken: input.config.botToken,
    callbackQueryId: input.callback.callbackQueryId,
    text: "Showing next leads.",
    fetchImpl: input.fetchImpl
  });
  await sendTelegramMessage({
    botToken: input.config.botToken,
    chatId: input.callback.chatId,
    text: response.text,
    parseMode: "HTML",
    replyMarkup: createTelegramResponseReplyMarkup(response.buttons, input.config.crmBaseUrl),
    fetchImpl: input.fetchImpl
  });
}

async function trySyncTelegramReminderToCalendar(input: {
  workspaceId: string;
  leadId: string;
  dueAt: Date;
  summary: string;
}): Promise<CalendarSyncResult | null> {
  try {
    return await syncEventToGoogleCalendar({
      workspaceId: input.workspaceId,
      title: `Follow up ${input.leadId}`,
      startsAt: input.dueAt,
      endsAt: new Date(input.dueAt.getTime() + 30 * 60 * 1000),
      description: input.summary
    });
  } catch (error) {
    console.warn(error instanceof Error ? error.message : error);
    return null;
  }
}

async function saveTelegramLeadCardReplyContext(
  config: Pick<TelegramWorkerConfig, "workspaceId">,
  client: TelegramWorkerPrismaLike,
  chatId: string,
  lead: Awaited<ReturnType<TelegramWorkerPrismaLike["lead"]["findMany"]>>[number] | null,
  messageId: number | undefined
): Promise<void> {
  if (!lead?.id || messageId === undefined || !client.lead.update) {
    return;
  }

  try {
    await client.lead.update({
      where: { id: lead.id },
      data: {
        rawInput: appendTelegramBotLeadMessageMarker(lead.rawInput ?? "", chatId, messageId)
      }
    });
  } catch (error) {
    console.warn(error instanceof Error ? error.message : error);
  }
}

function createTelegramUndoUpdateDoneReplyMarkup(crmBaseUrl: string | undefined, record: TelegramLeadUndoActionRecord): unknown | undefined {
  const buttons: Array<{ text: string; url: string } | { text: string; callback_data: string }> = [];
  const crmUrl = createTelegramAbsoluteButtonUrl(`/leads?leadId=${encodeURIComponent(record.leadId)}`, crmBaseUrl);
  if (crmUrl) {
    buttons.push({ text: "CRM", url: crmUrl });
  }
  buttons.push({ text: "Create new lead from this source", callback_data: createTelegramLeadRecreateCallbackData(record.leadId, record.actionId) });

  return { inline_keyboard: chunkTelegramButtons(buttons, 1) };
}

function isPrismaRecordNotFoundError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const candidate = error as { code?: unknown; message?: unknown };
  if (candidate.code === "P2025") {
    return true;
  }

  return typeof candidate.message === "string" && /No record was found for an update/i.test(candidate.message);
}

async function sendTelegramServerErrorFallbackMessage(input: {
  botToken: string;
  chatId: string;
  processingMaterials?: boolean;
  fetchImpl: typeof fetch;
}): Promise<void> {
  try {
    await sendTelegramMessage({
      botToken: input.botToken,
      chatId: input.chatId,
      text: input.processingMaterials
        ? "Server error occurred while processing your materials. Please try again later."
        : "Server error occurred. Please try again later.",
      fetchImpl: input.fetchImpl
    });
  } catch (error) {
    console.warn(error instanceof Error ? error.message : error);
  }
}

async function sendTelegramProcessingAcknowledgement(input: {
  botToken: string;
  chatId: string;
  message: Pick<AllowedTelegramMessageBatch, "attachments" | "sourceMessageIds" | "text">;
  fetchImpl: typeof fetch;
}): Promise<boolean> {
  const text = createTelegramProcessingAcknowledgementText(input.message);
  if (!text) {
    return false;
  }

  try {
    await sendTelegramMessage({
      botToken: input.botToken,
      chatId: input.chatId,
      text,
      fetchImpl: input.fetchImpl
    });
    return true;
  } catch (error) {
    console.warn(error instanceof Error ? error.message : error);
    return false;
  }
}

function createTelegramProcessingAcknowledgementText(
  message: Pick<AllowedTelegramMessageBatch, "attachments" | "sourceMessageIds" | "text">
): string | null {
  const attachmentCount = message.attachments?.length ?? 0;
  const isLongText = message.text.trim().length >= 1200;

  if (attachmentCount <= 0 && message.sourceMessageIds.length <= 1 && !isLongText) {
    return null;
  }

  const materialLabel =
    attachmentCount > 1 || message.sourceMessageIds.length > 1
      ? "several files/messages"
      : attachmentCount === 1
        ? "your file"
        : "your message";

  return `I received ${materialLabel}. I am reading and extracting the important CRM/KP fields now. This can take a little time.`;
}

function createTelegramInteractionSummary(messageText: string, changedFields: string[]): string {
  const text = messageText.trim();
  if (text && changedFields.length === 0) {
    return text.length > 180 ? `${text.slice(0, 177).trimEnd()}...` : text;
  }

  if (changedFields.length > 0) {
    return `Updated ${changedFields.join(", ")}${text ? ` from: ${text}` : ""}`;
  }

  return "Telegram interaction saved.";
}

function createTelegramLeadHistoryUpdatedMessage(leadId: string, summary: string, calendarSync?: CalendarSyncResult | null): string {
  return [
    `<b>${escapeHtml(leadId)}</b> updated in CRM.`,
    "",
    `History note: <b>${escapeHtml(summary)}</b>`,
    calendarSync?.status === "synced" ? `Google Calendar synced: <b>${escapeHtml(calendarSync.googleEventId)}</b>` : "",
    calendarSync?.status === "skipped" ? "Google Calendar sync is not connected yet." : ""
  ]
    .filter(Boolean)
    .join("\n");
}

function createTelegramLeadCardMessage(lead: Awaited<ReturnType<TelegramWorkerPrismaLike["lead"]["findMany"]>>[number]): string {
  const fields = [
    ["Lead name", lead.displayName],
    ["Status", lead.status],
    ["Temperature", lead.temperature],
    ["Client", getLeadClientName(lead)],
    ["Request type", lead.requestType],
    ["Project address", lead.projectAddress],
    ["BGF m2", lead.bgfM2 === null || lead.bgfM2 === undefined ? "" : String(lead.bgfM2)],
    ["Email", getLeadEmail(lead)],
    ["Phone", getLeadPhone(lead)],
    ["Missing for KP", Array.isArray(lead.missingData) && lead.missingData.length > 0 ? lead.missingData.join(", ") : ""]
  ].filter(([, value]) => isMeaningfulTelegramFieldValue(value));

  return [
    `<b>${escapeHtml(lead.leadId)}</b>`,
    ...fields.map(([label, value]) => `${escapeHtml(String(label))}: <b>${escapeHtml(String(value))}</b>`),
    "",
    "Reply to this lead card to update the lead, add a note, or add a reminder."
  ].join("\n");
}

function createTelegramExistingLeadClarificationMessage(leadId: string, matchedFields: string[]): string {
  return [
    `This may belong to lead <b>${escapeHtml(leadId)}</b>.`,
    matchedFields.length > 0 ? `Matched: ${matchedFields.map(escapeHtml).join(", ")}.` : "",
    "Please reply to that lead card if you want me to add this information there, or send new lead to start a separate lead."
  ]
    .filter(Boolean)
    .join("\n");
}

export async function runTelegramWorkerOnce(config: TelegramWorkerConfig & { offset?: number }): Promise<TelegramWorkerResult> {
  await ensureTelegramBotCommandMenu(config);
  const updates = await fetchTelegramUpdates({
    botToken: config.botToken,
    offset: config.offset,
    fetchImpl: config.fetchImpl
  });
  const result = await processTelegramUpdates(updates, config);

  if (result.lastUpdateId !== undefined) {
    await fetchTelegramUpdates({
      botToken: config.botToken,
      offset: result.lastUpdateId + 1,
      fetchImpl: config.fetchImpl
    });
  }

  return result;
}

async function ensureTelegramBotCommandMenu(config: Pick<TelegramWorkerConfig, "botToken" | "fetchImpl">): Promise<void> {
  if (telegramBotCommandMenuMemory.has(config.botToken)) {
    return;
  }

  try {
    await setTelegramBotCommands({
      botToken: config.botToken,
      commands: TELEGRAM_BOT_COMMANDS,
      fetchImpl: config.fetchImpl
    });
    telegramBotCommandMenuMemory.add(config.botToken);
  } catch (error) {
    console.error("[telegram-worker] failed to set bot command menu", error);
  }
}

export async function runTelegramWorkerFromEnv(env = process.env): Promise<TelegramWorkerResult> {
  loadRootEnv();
  const botToken = env.TELEGRAM_BOT_TOKEN;
  const apiKey = env.OPENAI_API_KEY;

  if (!botToken) {
    throw new Error("TELEGRAM_BOT_TOKEN is required");
  }

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required");
  }

  const workspaceId = env.TELEGRAM_WORKSPACE_ID ?? "workspace-demo";
  const aiSettings = await resolveTelegramAiSettings(createWorkspaceAiSettingPrismaStore(defaultPrisma as never), workspaceId);
  const clientMaterialAnalysisSetting = aiSettings.clientMaterialAnalysis;
  const crmEntityStore = createCrmEntityPrismaStore(defaultPrisma as never);
  const config = {
    allowedChatIds: parseAllowedChatIds(env.TELEGRAM_ALLOWED_CHAT_IDS),
    botToken,
    workspaceId,
    crmBaseUrl: env.TELEGRAM_CRM_BASE_URL ?? env.NEXT_PUBLIC_APP_URL,
    generateKpDocument: createAssistantGeneratedDocumentPrismaStore(defaultPrisma, {
      objectStorage: createObjectStorageFromEnv(),
      pdfConverter: createLibreOfficeDocxToPdfConverter()
    }).create,
    saveAuditEvent: createAssistantPrismaRepository(defaultPrisma).saveAuditEvent,
    saveSourceAttachment: createTelegramSourceAttachmentStore(defaultPrisma, createObjectStorageFromEnv()).save,
    kpRequiredFields: await resolveCurrentKpRequiredFields(defaultPrisma as TelegramTemplatePrismaLike, workspaceId),
    audioTranscriber: createOpenAiAudioTranscriber({
      apiKey,
      model: env.OPENAI_AUDIO_TRANSCRIBE_MODEL ?? "gpt-4o-mini-transcribe"
    }),
    crmOrchestrator: createOpenAiCrmOrchestrator({
      apiKey,
      model: aiSettings.crmOrchestrator.model || env.OPENAI_MODEL || "gpt-4o-mini",
      prompt: aiSettings.crmOrchestrator.prompt
    }),
    crmEntityExtractor: createOpenAiCrmEntityExtractor({
      apiKey,
      model: aiSettings.crmEntityExtractor.model || env.OPENAI_MODEL || "gpt-4o-mini",
      prompt: aiSettings.crmEntityExtractor.prompt
    }),
    saveLeadEntityExtraction: crmEntityStore.saveLeadEntityExtraction,
    parser: createOpenAiLeadParserClient({
      apiKey,
      model: clientMaterialAnalysisSetting.model || env.OPENAI_MODEL || "gpt-4o-mini",
      prompt: clientMaterialAnalysisSetting.prompt
    })
  };
  const testUpdate = createTelegramTestUpdateFromEnv(env);

  if (testUpdate) {
    return processTelegramUpdates([testUpdate], config);
  }

  return runTelegramWorkerOnce(config);
}

export async function resolveTelegramAiSettings(store: WorkspaceAiSettingStore, workspaceId: string): Promise<{
  clientMaterialAnalysis: WorkspaceAiSettingRecord;
  crmOrchestrator: WorkspaceAiSettingRecord;
  crmEntityExtractor: WorkspaceAiSettingRecord;
}> {
  const [clientMaterialAnalysis, crmOrchestrator, crmEntityExtractor] = await Promise.all([
    store.getClientMaterialAnalysis(workspaceId),
    store.getCrmOrchestrator(workspaceId),
    store.getCrmEntityExtractor(workspaceId)
  ]);

  return { clientMaterialAnalysis, crmOrchestrator, crmEntityExtractor };
}

export async function runTelegramWorkerLoop({
  intervalMs = 5000,
  maxIterations,
  runOnce,
  sleep = defaultSleep,
  onResult
}: TelegramWorkerLoopConfig): Promise<TelegramWorkerLoopResult> {
  let iterations = 0;
  let processed = 0;
  let ignored = 0;

  while (maxIterations === undefined || iterations < maxIterations) {
    const iteration = iterations + 1;
    const result = await runOnce(iteration);
    iterations = iteration;
    processed += result.processed;
    ignored += result.ignored;
    onResult?.(result, iteration);

    if (maxIterations !== undefined && iterations >= maxIterations) {
      break;
    }

    await sleep(intervalMs);
  }

  return { iterations, processed, ignored };
}

export async function runTelegramWorkerLoopFromEnv(env = process.env): Promise<TelegramWorkerLoopResult> {
  const intervalMs = Number(env.TELEGRAM_POLL_INTERVAL_MS ?? "5000");
  return runTelegramWorkerLoop({
    intervalMs: Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : 5000,
    runOnce: () => runTelegramWorkerFromEnv(env),
    onResult: (result, iteration) => {
      console.log(
        `[telegram-loop] iteration=${iteration} processed=${result.processed} ignored=${result.ignored}${
          result.lastUpdateId === undefined ? "" : ` lastUpdateId=${result.lastUpdateId}`
        }`
      );
    }
  });
}

async function hydrateTelegramLeadMessage(message: AllowedTelegramMessage, config: TelegramWorkerConfig): Promise<TelegramLeadMessage> {
  const base = {
    chatId: message.chatId,
    messageId: message.messageId,
    sourceMessageIds: "sourceMessageIds" in message ? (message.sourceMessageIds as number[]) : [message.messageId],
    receivedAt: message.receivedAt,
    authorName: message.authorName,
    authorUsername: message.authorUsername
  };

  if (!message.attachments?.length) {
    return {
      ...base,
      text: appendTelegramAuthorLine(message.text, message)
    };
  }

  const attachments = await Promise.all(message.attachments.map((attachment) => downloadTelegramAttachment(attachment, message, config)));
  const text = [
    message.text,
    createTelegramAudioTranscriptText(attachments),
    createTelegramAuthorLine(message)
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    ...base,
    attachments,
    text
  };
}

async function downloadTelegramAttachment(
  attachment: TelegramPendingAttachment,
  message: Pick<AllowedTelegramMessage, "chatId" | "receivedAt">,
  config: TelegramWorkerConfig
): Promise<TelegramLeadAttachment> {
  const fetchImpl = config.fetchImpl ?? fetch;
  const params = new URLSearchParams({ file_id: attachment.fileId });
  const metadataResponse = await fetchImpl(`https://api.telegram.org/bot${config.botToken}/getFile?${params.toString()}`);

  if (!metadataResponse.ok) {
    throw new Error(`Telegram getFile failed: ${metadataResponse.status} ${metadataResponse.statusText}`);
  }

  const metadata = (await metadataResponse.json()) as TelegramGetFileResponse;
  const filePath = metadata.result?.file_path;

  if (!metadata.ok || !filePath) {
    throw new Error("Telegram getFile returned no file path");
  }

  const fileResponse = await fetchImpl(`https://api.telegram.org/file/bot${config.botToken}/${filePath}`);
  if (!fileResponse.ok) {
    throw new Error(`Telegram file download failed: ${fileResponse.status} ${fileResponse.statusText}`);
  }

  const body = new Uint8Array(await fileResponse.arrayBuffer());
  const base64 = Buffer.from(body).toString("base64");
  const savedSource = await saveTelegramSourceAttachment(attachment, message, body, config);
  const downloaded = {
    kind: attachment.kind,
    mimeType: attachment.mimeType,
    fileName: attachment.fileName,
    sourceFileId: attachment.fileId,
    sourceAttachmentId: savedSource?.attachmentId,
    sourceStorageKey: savedSource?.storageKey,
    base64
  };

  if (attachment.kind !== "audio" || !config.audioTranscriber) {
    return downloaded;
  }

  try {
    const transcript = await config.audioTranscriber.transcribe({
      base64,
      mimeType: attachment.mimeType,
      fileName: attachment.fileName ?? "telegram-audio.ogg",
      language: "ru"
    });

    return {
      ...downloaded,
      transcript: transcript.text
    };
  } catch (error) {
    return {
      ...downloaded,
      transcriptError: error instanceof Error ? error.message : String(error)
    };
  }
}

async function saveTelegramSourceAttachment(
  attachment: TelegramPendingAttachment,
  message: Pick<AllowedTelegramMessage, "chatId" | "receivedAt">,
  body: Uint8Array,
  config: TelegramWorkerConfig
): Promise<TelegramSourceAttachmentRecord | undefined> {
  if (!config.saveSourceAttachment) {
    return undefined;
  }

  try {
    return await config.saveSourceAttachment({
      workspaceId: config.workspaceId,
      chatId: message.chatId,
      messageId: attachment.sourceMessageId,
      fileId: attachment.fileId,
      kind: attachment.kind,
      fileName: attachment.fileName ?? createTelegramSourceAttachmentFileName(attachment),
      mimeType: attachment.mimeType,
      body,
      receivedAt: message.receivedAt,
      requestedByUserId: `telegram:${message.chatId}`
    });
  } catch (error) {
    console.warn(error instanceof Error ? error.message : error);
    return undefined;
  }
}

function createTelegramAudioTranscriptText(attachments: TelegramLeadAttachment[]): string {
  return attachments
    .map((attachment, index) => {
      if (attachment.kind !== "audio" || !attachment.transcript?.trim()) {
        return "";
      }

      return `Audio transcript ${index + 1} (${attachment.fileName ?? "telegram-audio"}):\n${attachment.transcript.trim()}`;
    })
    .filter(Boolean)
    .join("\n\n");
}

function hasAudioTranscriptionFailure(message: TelegramLeadMessage): boolean {
  return message.attachments?.some((attachment) => attachment.kind === "audio" && !attachment.transcript?.trim() && attachment.transcriptError) ?? false;
}

function createTelegramAudioTranscriptionFailureMessage(): string {
  return [
    "I received the audio, but I could not transcribe it.",
    "Please resend the voice message, send a text summary, or add photos/PDFs with the missing details."
  ].join("\n");
}

function createTelegramLeadParseFailureMessage(): string {
  return [
    "I could not parse this lead yet.",
    "Please resend the text summary, or send the PDF/photo/audio in smaller separate messages. I will try again on the next message."
  ].join("\n");
}

function createTelegramLimitedActionsText(leadId?: string): string {
  return [
    leadId ? `Lead <b>${escapeHtml(leadId)}</b> found.` : "Telegram actions are limited right now.",
    "Use new lead to create a lead, or search lead to find one.",
    "After a lead card is shown, reply to that card to update the lead, add a note, or add a reminder."
  ].join("\n");
}

function createTelegramSourceAttachmentStore(client: TelegramSourceAttachmentPrismaLike, objectStorage: ObjectStorage) {
  return {
    async save(input: TelegramSourceAttachmentInput): Promise<TelegramSourceAttachmentRecord> {
      if (!client.attachment) {
        throw new Error("Attachment storage is not available for Telegram source material.");
      }

      const storageKey = createTelegramSourceAttachmentStorageKey(input);
      await objectStorage.putObject({
        key: storageKey,
        body: input.body,
        contentType: input.mimeType
      });
      const attachment = await client.attachment.create({
        data: {
          workspaceId: input.workspaceId,
          storageKey,
          fileName: input.fileName,
          mimeType: input.mimeType,
          sizeBytes: input.body.byteLength,
          status: "draft",
          source: "telegram_source",
          createdByUserId: input.requestedByUserId
        }
      });

      return { attachmentId: attachment.id, storageKey };
    }
  };
}

function createTelegramSourceAttachmentStorageKey(input: TelegramSourceAttachmentInput): string {
  return [
    "workspaces",
    toStorageSegment(input.workspaceId),
    "telegram-source",
    toStorageSegment(input.chatId),
    `${input.messageId}-${toStorageSegment(input.fileId)}-${toStorageSegment(input.fileName)}`
  ].join("/");
}

function createTelegramSourceAttachmentFileName(attachment: TelegramPendingAttachment): string {
  if (attachment.kind === "photo") {
    return `telegram-photo-${attachment.sourceMessageId}.jpg`;
  }

  if (attachment.kind === "audio") {
    return `telegram-audio-${attachment.sourceMessageId}.ogg`;
  }

  return `telegram-document-${attachment.sourceMessageId}.pdf`;
}

function toStorageSegment(value: string | number): string {
  return (
    String(value)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, "-")
      .replace(/^-+|-+$/g, "") || "item"
  );
}

function appendTelegramAuthorLine(text: string, message: Pick<AllowedTelegramMessage, "authorName" | "authorUsername">): string {
  return [text, createTelegramAuthorLine(message)].filter(Boolean).join("\n\n");
}

function createTelegramAuthorLine(message: Pick<AllowedTelegramMessage, "authorName" | "authorUsername">): string {
  const username = message.authorUsername ? `@${message.authorUsername}` : "";
  const author = [message.authorName, username ? `(${username})` : ""].filter(Boolean).join(" ").trim();

  return author ? `Author: ${author}` : "";
}

function defaultSleep(intervalMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, intervalMs));
}

function createAllowedTelegramLeadActionCallbacks(
  updates: TelegramUpdate[],
  allowedChatIds: Set<string>
): AllowedTelegramLeadActionCallback[] {
  return updates.flatMap((update) => {
    const callback = update.callback_query;
    const chatId = callback?.message ? String(callback.message.chat.id) : "";
    const parsed = parseTelegramLeadActionCallbackData(callback?.data);

    if (!callback || !parsed || !allowedChatIds.has(chatId)) {
      return [];
    }

    return [
      {
        updateId: update.update_id,
        callbackQueryId: callback.id,
        chatId,
        messageId: callback.message?.message_id,
        receivedAt: new Date((callback.message?.date ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
        action: parsed.action,
        leadId: parsed.leadId,
        actionId: parsed.actionId,
        offset: parsed.offset
      }
    ];
  });
}

function isTelegramLeadRecordCallback(callback: AllowedTelegramLeadActionCallback): callback is TelegramLeadRecordCallback {
  return typeof callback.leadId === "string" && callback.leadId.length > 0;
}

function isTelegramSearchNextCallback(callback: AllowedTelegramLeadActionCallback): callback is TelegramSearchNextCallback {
  return callback.action === "search_next" && typeof callback.offset === "number" && Number.isFinite(callback.offset);
}

function createAllowedTelegramMessageBatches(messages: AllowedTelegramMessage[], batchWindowMs = 120_000): AllowedTelegramMessageBatch[] {
  const sorted = [...messages].sort((left, right) => {
    if (left.chatId !== right.chatId) {
      return left.chatId.localeCompare(right.chatId);
    }

    return new Date(left.receivedAt).getTime() - new Date(right.receivedAt).getTime();
  });
  const batches: AllowedTelegramMessageBatch[] = [];

  for (const message of sorted) {
    const previous = batches[batches.length - 1];
    const previousTime = previous ? new Date(previous.receivedAt).getTime() : 0;
    const messageTime = new Date(message.receivedAt).getTime();
    const canMerge =
      previous &&
      previous.chatId === message.chatId &&
      previous.replyToMessageId === undefined &&
      message.replyToMessageId === undefined &&
      Math.abs(messageTime - previousTime) <= batchWindowMs &&
      !isTelegramHelpRequest(previous) &&
      !isTelegramHelpRequest(message);

    if (!canMerge) {
      batches.push({
        ...message,
        sourceMessageIds: [message.messageId],
        updateIds: [message.updateId]
      });
      continue;
    }

    previous.messageId = Math.min(previous.messageId, message.messageId);
    previous.receivedAt = new Date(Math.min(previousTime, messageTime)).toISOString();
    previous.text = [previous.text, message.text].filter(Boolean).join("\n\n---\n\n");
    previous.sourceMessageIds.push(message.messageId);
    previous.updateIds.push(message.updateId);
    previous.attachments = [...(previous.attachments ?? []), ...(message.attachments ?? [])];
  }

  return batches;
}

function isTelegramHelpRequest(message: Pick<AllowedTelegramMessage, "text" | "attachments" | "replyToMessageId">): boolean {
  const text = message.text.trim();

  if ((message.attachments?.length ?? 0) > 0) {
    return false;
  }

  if (message.replyToMessageId !== undefined) {
    return false;
  }

  return (
    /^\/(help|about)(@\w+)?$/i.test(text) ||
    /(what can you do|help|capabilities|что ты умеешь|что умеешь|помощь|как работает)/i.test(text) ||
    text.length < 12
  );
}

function isTelegramSearchModeStartCommand(message: Pick<AllowedTelegramMessage, "text" | "attachments" | "replyToMessageId">): boolean {
  const text = message.text.trim();
  return (
    (message.attachments?.length ?? 0) === 0 &&
    message.replyToMessageId === undefined &&
    /^(?:\/searchlead(?:@\w+)?|\/search(?:@\w+)?\s+lead|search\s+lead)\s*$/i.test(text)
  );
}

function createTelegramSearchModeKey(workspaceId: string, chatId: string): string {
  return `${workspaceId}:${chatId}`;
}

function isTelegramSearchModeActive(workspaceId: string, chatId: string): boolean {
  return telegramSearchModeMemory.has(createTelegramSearchModeKey(workspaceId, chatId));
}

function isTelegramSearchCapabilityQuestion(message: Pick<AllowedTelegramMessage, "text" | "attachments" | "replyToMessageId">): boolean {
  const text = message.text.trim();

  if ((message.attachments?.length ?? 0) > 0 || message.replyToMessageId !== undefined) {
    return false;
  }

  return /\b(search|find)\b.*\b(work|works|available|enabled|possible|can|how)\b/i.test(text) || /\b(can|how|does|do)\b.*\b(search|find)\b/i.test(text);
}

function createTelegramSearchCapabilityMessage(): string {
  return [
    "Search works.",
    "Use search lead to enter search mode, then send a name, title, tag, phone, email, or location.",
    "Examples: show last 10 leads; find Schneider lake; search by tag residential."
  ].join("\n");
}

function isTelegramStartRequest(message: Pick<AllowedTelegramMessage, "text" | "attachments" | "replyToMessageId">): boolean {
  const text = message.text.trim();

  if ((message.attachments?.length ?? 0) > 0 || message.replyToMessageId !== undefined) {
    return false;
  }

  return /^\/start(@\w+)?$/i.test(text);
}

function isTelegramKpSentUndoCommand(message: Pick<AllowedTelegramMessage, "text" | "attachments">): boolean {
  const text = message.text.trim();

  if ((message.attachments?.length ?? 0) > 0) {
    return false;
  }

  return /(undo|отмени|откат|верни|не отправ)/i.test(text) && /(kp|кп|commercial proposal|offer|отправ)/i.test(text);
}

function isTelegramLeadUndoClarificationRequest(message: Pick<AllowedTelegramMessageBatch, "text" | "attachments" | "replyToMessageId">): boolean {
  const text = message.text.trim();

  if ((message.attachments?.length ?? 0) > 0) {
    return false;
  }

  if (isTelegramKpSentUndoCommand(message)) {
    return false;
  }

  const hasUndoIntent = /(undo|revert|rollback|cancel|remove|delete|archive|отмени|отменить|откат|откатить|верни|удали|удалить|архив)/i.test(text);
  const hasLeadTarget = /(lead|лид|лида|заявк|карточк|client|клиент)/i.test(text) || /\bL-\d{4}-\d+\b/i.test(text);

  return hasUndoIntent && hasLeadTarget;
}

function createTelegramLeadUndoClarificationMessage(): string {
  return [
    "I can undo the last lead create/update through the <b>Undo</b> button on the lead reply.",
    "If the update should become a separate new lead, press <b>Undo</b> first, then choose <b>Create new lead from this source</b>.",
    "If you mean another lead, reply to that lead card or send its lead number."
  ].join("\n");
}

function isTelegramKpSentCommand(message: Pick<AllowedTelegramMessage, "text" | "attachments">): boolean {
  const text = message.text.trim();

  if ((message.attachments?.length ?? 0) > 0) {
    return false;
  }

  return /(kp|кп|commercial proposal|offer).{0,24}(sent|send|отправ|выслал|выслали)/i.test(text);
}

function createTelegramSharedHelpMessage(workspaceId: string, chatId: string, content: "/start" | "/help"): string {
  return createAssistantChannelResponse(
    createTelegramAssistantChannelMessage(workspaceId, {
      chatId,
      text: content,
      receivedAt: new Date().toISOString(),
      sourceMessageIds: [content === "/start" ? 0 : 1]
    })
  ).text;
}

function createTelegramGeneralAssistantResponse(
  workspaceId: string,
  message: Pick<AllowedTelegramMessageBatch, "chatId" | "text" | "receivedAt" | "sourceMessageIds" | "attachments">,
  replyTo?: { leadId: string; sourceMessageId: string }
) {
  if (!replyTo && shouldPreferTelegramLeadIntake(message)) {
    return null;
  }

  if (!replyTo && isDisabledTelegramEarlyAssistantRequest(message.text)) {
    return createTelegramLimitedActionsResponse();
  }

  const response = createAssistantChannelResponse(createTelegramAssistantChannelMessage(workspaceId, message, replyTo));

  if (response.intent === "capability_request" || response.shouldPersistFeedback || hasDownloadCsvAction(response)) {
    return createTelegramLimitedActionsResponse();
  }

  if (isGenericTelegramLimitedActionsResponse(response)) {
    return null;
  }

  if (
    response.intent === "support_request" ||
    (response.intent === "crm_action" &&
      (isReminderRequest(message.text) || isLeadInteractionNoteCommand(message.text) || isLeadNaturalContextNote(message.text)))
  ) {
    return response;
  }

  return null;
}

async function createTelegramSearchModeStartedResponse(
  config: Pick<TelegramWorkerConfig, "workspaceId" | "crmBaseUrl">,
  client: TelegramWorkerPrismaLike,
  offset = 0
) {
  const records = (await findTelegramLeadSearchRecords(config, client)).map(toTelegramLeadSearchRecord);
  const pageSize = 5;
  const safeOffset = Math.max(0, offset);
  const page = records.slice(safeOffset, safeOffset + pageSize);
  const response = createLeadSearchFilterResponse("show last 5 leads", page, {
    includeCrmButtons: true,
    telegramLeadButtons: true,
    limit: pageSize
  });
  const hasNext = records.length > safeOffset + pageSize;
  const buttons = [
    ...createTelegramLeadIdButtonLabels(response.buttons),
    ...(hasNext ? [{ label: "next 5", action: "search_next", value: String(safeOffset + pageSize) }] : [])
  ];
  const rangeLabel = safeOffset === 0 ? "latest five leads" : `leads ${safeOffset + 1}-${safeOffset + page.length}`;
  const foundLabel = records.length === 0 ? "no leads found" : `${page.length} of ${records.length} leads found`;

  return {
    text: [
      `search mode <b>${escapeHtml(rangeLabel)}</b> ${escapeHtml(foundLabel)}.`,
      response.text,
      "",
      "Send a lead name, project title, address, tag, phone, email, status, date, or a phrase like \"show last 10 leads\".",
      "Use new lead when you want to switch to creating a lead."
    ].join("\n"),
    buttons
  };
}

async function createTelegramSearchFilterResponse(
  config: Pick<TelegramWorkerConfig, "workspaceId" | "crmBaseUrl">,
  client: TelegramWorkerPrismaLike,
  message: Pick<AllowedTelegramMessageBatch, "chatId" | "text" | "receivedAt" | "sourceMessageIds" | "attachments" | "replyToMessageId">
) {
  if (message.replyToMessageId !== undefined) {
    return null;
  }

  const isSearchMode = isTelegramSearchModeActive(config.workspaceId, message.chatId);
  if ((message.attachments?.length ?? 0) > 0 || (!isSearchMode && !isTelegramSearchOrFilterRequest(message.text))) {
    return null;
  }

  const searchText = isSearchMode && !isTelegramSearchOrFilterRequest(message.text) ? `search ${message.text}` : message.text;
  if (!isSearchMode) {
    const decision = routeCrmOrchestratorRequest(createTelegramAssistantChannelMessage(config.workspaceId, { ...message, text: searchText }));
    if (decision.intent !== "SEARCH_LEAD" && !isTelegramSearchOrFilterRequest(message.text)) {
      return null;
    }
  }

  const records = await findTelegramLeadSearchRecords(config, client);

  const response = createLeadSearchFilterResponse(searchText, records.map(toTelegramLeadSearchRecord), {
    includeCrmButtons: true,
    telegramLeadButtons: true
  });

  return {
    ...response,
    buttons: createTelegramLeadIdButtonLabels(response.buttons)
  };
}

function createTelegramLeadIdButtonLabels<T extends { label: string; action?: string; value?: string }>(buttons: T[]): T[] {
  return buttons.map((button) =>
    button.action === "open_lead" && button.value ? { ...button, label: button.value } : button
  );
}

async function findTelegramLeadSearchRecords(config: Pick<TelegramWorkerConfig, "workspaceId">, client: TelegramWorkerPrismaLike) {
  return client.lead.findMany({
    where: { workspaceId: config.workspaceId },
    orderBy: [{ createdDate: "desc" }, { leadId: "asc" }],
    select: {
      id: true,
      leadId: true,
      displayName: true,
      searchTags: true,
      createdDate: true,
      status: true,
      temperature: true,
      requestType: true,
      projectAddress: true,
      client: {
        select: {
          name: true,
          email: true,
          phone: true
        }
      }
    }
  });
}

function toTelegramLeadSearchRecord(record: {
  id?: string;
  leadId: string;
  displayName?: string | null;
  searchTags?: unknown;
  createdDate?: Date | string | null;
  status?: string | null;
  temperature?: string | null;
  requestType?: string | null;
  projectAddress?: string | null;
  email?: string | null;
  phone?: string | null;
  client?: { name?: string | null; email?: string | null; phone?: string | null } | null;
  clientName?: string | null;
}): LeadSearchRecord {
  return {
    id: record.id ?? record.leadId,
    leadId: record.leadId,
    displayName: record.displayName,
    searchTags: normalizeTelegramLeadSearchTags(record.searchTags),
    createdDate: record.createdDate ?? new Date(0),
    status: record.status ?? "unknown",
    temperature: record.temperature,
    requestType: record.requestType,
    projectAddress: record.projectAddress,
    clientName: record.client?.name ?? record.clientName ?? null,
    email: record.client?.email ?? record.email ?? null,
    phone: record.client?.phone ?? record.phone ?? null
  };
}

function normalizeTelegramLeadSearchTags(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : null;
}

function hasDownloadCsvAction(response: { buttons?: Array<{ action?: string }> }): boolean {
  return response.buttons?.some((button) => button.action === "download_csv") ?? false;
}

function isGenericTelegramLimitedActionsResponse(response: { text: string; buttons?: Array<unknown> }): boolean {
  return response.text === createTelegramLimitedActionsText() && (response.buttons?.length ?? 0) === 0;
}

function shouldPreferTelegramLeadIntake(
  message: Pick<AllowedTelegramMessageBatch, "text" | "sourceMessageIds" | "attachments">
): boolean {
  return (
    (message.attachments?.length ?? 0) > 0 ||
    message.sourceMessageIds.length > 1 ||
    (looksLikeTelegramLeadSourceMaterial(message.text) && !isDisabledTelegramEarlyAssistantRequest(message.text) && !isTelegramSearchOrFilterRequest(message.text))
  );
}

function isDisabledTelegramEarlyAssistantRequest(text: string): boolean {
  return isTelegramThemeCapabilityRequest(text);
}

function isTelegramThemeCapabilityRequest(text: string): boolean {
  return (
    /\b(theme|dark mode|night mode|evening theme|color scheme|appearance|graphite|nocturne)\b/i.test(text) ||
    /(тем[ауы]|темн\w*|ночн\w*\s+режим|вечерн\w*\s+тем|цветов\w*\s+схем|оформлен|внешн\w*\s+вид)/i.test(text) ||
    /(С‚РµРјР°|С‚РµРјРЅ\w*|РЅРѕС‡РЅ\w*\s+СЂРµР¶РёРј|РІРµС‡РµСЂРЅ\w*\s+С‚РµРј|С†РІРµС‚РѕРІ\w*\s+СЃС…РµРј|РѕС„РѕСЂРјР»РµРЅ|РІРЅРµС€РЅ\w*\s+РІРёРґ)/i.test(text)
  );
}

function isTelegramTableExportRequest(text: string): boolean {
  return /\b(csv|excel|xlsx|spreadsheet|export)\b/i.test(text) || /(csv|excel|экспорт|скачай|скинь|таблиц)/i.test(text);
}

function isTelegramSearchOrFilterRequest(text: string): boolean {
  if (isTelegramTableExportRequest(text)) {
    return true;
  }
  return (
    /\b(find|search|look up|pull up|show|open|list|filter|get)\b/i.test(text) ||
    /(покажи|найди|найти|ищи|выведи|дай|фильтр|отфильтруй|по\s+названию|по\s+имени)/iu.test(text)
  );
}

async function createTelegramCrmOrchestratorFallbackResponse(
  config: Pick<TelegramWorkerConfig, "crmOrchestrator" | "workspaceId">,
  message: Pick<AllowedTelegramMessageBatch, "chatId" | "text" | "receivedAt" | "sourceMessageIds" | "attachments">,
  replyTo?: { leadId: string; sourceMessageId: string }
) {
  if (!config.crmOrchestrator || !shouldUseCrmOrchestratorFallback(message, replyTo)) {
    return null;
  }

  let decision: CrmOrchestratorDecision;
  try {
    decision = await config.crmOrchestrator.route(createTelegramAssistantChannelMessage(config.workspaceId, message, replyTo));
  } catch (error) {
    console.warn(error instanceof Error ? error.message : error);
    return null;
  }

  if (!decision) {
    return createTelegramLimitedActionsResponse();
  }

  if (decision.intent === "CREATE_LEAD") {
    return null;
  }

  if (decision.status === "need_clarification" || decision.intent === "CLARIFICATION_REQUIRED") {
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
    return createTelegramLimitedActionsResponse();
  }

  if (decision.intent === "CREATE_REMINDER") {
    return createTelegramLimitedActionsResponse();
  }

  if (decision.intent === "SUPPORT_REQUEST") {
    return {
      intent: "support_request",
      shouldPersistFeedback: false,
      feedbackType: undefined,
      buttons: [],
      normalizedActions: [],
      text: "I can help with CRM questions here. Right now Telegram actions cover creating leads, updating existing leads, and searching CRM leads."
    };
  }

  return null;
}

function createTelegramLimitedActionsResponse() {
  return {
    intent: "support_request",
    shouldPersistFeedback: false,
    feedbackType: undefined,
    buttons: [],
    normalizedActions: [],
    text: createTelegramLimitedActionsText()
  };
}

function shouldUseCrmOrchestratorFallback(
  message: Pick<AllowedTelegramMessageBatch, "text" | "attachments">,
  replyTo?: { leadId: string; sourceMessageId: string }
): boolean {
  if (replyTo) {
    return false;
  }

  if ((message.attachments?.length ?? 0) > 0) {
    return false;
  }

  if (isTelegramSearchOrFilterRequest(message.text)) {
    return true;
  }

  return !looksLikeTelegramLeadSourceMaterial(message.text);
}

function looksLikeTelegramLeadSourceMaterial(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return (
    /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(text) ||
    /\+?\d[\d\s().-]{6,}\d/.test(text) ||
    /\b(bgf|m2|m²|wohnfl|wohnfl[aä]che|budget|eur|euro|angebot|kp|commercial proposal|offer|project address|project type)\b/i.test(text) ||
    /\b(neubau|umbau|efh|haus|villa|architektur|planung|baugenehmigung|baulantrag)\b/i.test(text) ||
    /\b(strasse|straße|weg|platz|allee|gasse|ufer|ring)\b/i.test(text) ||
    /(нужн|коммерческ|предложен|кп|адрес|площад|бюджет|дом|проект|архитектур|строительств)/i.test(text)
  );
}

function createTelegramAssistantChannelMessage(
  workspaceId: string,
  message: Pick<AllowedTelegramMessageBatch, "chatId" | "text" | "receivedAt" | "sourceMessageIds">,
  replyTo?: { leadId: string; sourceMessageId: string }
): AssistantChannelMessage {
  return {
    channel: "telegram",
    threadId: `telegram-${message.chatId}`,
    messageId: `telegram-${message.chatId}-${message.sourceMessageIds.join("-")}`,
    content: normalizeTelegramAssistantContent(message.text),
    receivedAt: message.receivedAt,
    context: {
      workspaceId,
      userId: `telegram:${message.chatId}`,
      role: "admin",
      route: "/telegram",
      module: "assistant"
    },
    attachments: [],
    ...(replyTo
      ? {
          replyTo: {
            sourceChannel: "telegram" as const,
            sourceMessageId: replyTo.sourceMessageId,
            leadId: replyTo.leadId
          }
        }
      : {})
  };
}

function normalizeTelegramAssistantContent(content: string): string {
  return content.trim().replace(/^\/([a-z_]+)@\w+/i, "/$1");
}

function createTelegramResponseReplyMarkup(buttons: Array<{ label: string; url?: string; action?: string; value?: string }> = [], crmBaseUrl?: string) {
  const telegramButtons = buttons
    .map((button) => {
      if (button.action === "open_lead" && button.value) {
        return { text: button.label, callback_data: createTelegramLeadOpenCallbackData(button.value) };
      }

      if (button.action === "search_next" && button.value) {
        return { text: button.label, callback_data: createTelegramSearchNextCallbackData(Number(button.value)) };
      }

      const url = createTelegramAbsoluteButtonUrl(button.url, crmBaseUrl);
      return url ? { text: button.label, url } : null;
    })
    .filter((button): button is { text: string; url: string } | { text: string; callback_data: string } => Boolean(button));

  if (telegramButtons.length === 0) {
    return undefined;
  }

  return {
    inline_keyboard: chunkTelegramButtons(telegramButtons, 2)
  };
}

function chunkTelegramButtons<T>(buttons: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < buttons.length; index += size) {
    rows.push(buttons.slice(index, index + size));
  }
  return rows;
}

function createTelegramAbsoluteButtonUrl(url: string | undefined, crmBaseUrl: string | undefined): string | null {
  const trimmed = url?.trim();
  if (!trimmed) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith("/") && crmBaseUrl?.trim()) {
    return `${crmBaseUrl.replace(/\/+$/, "")}${trimmed}`;
  }

  return null;
}
function createTelegramLeadConfirmation({
  leadId,
  status,
  draft,
  generatedDocumentId,
  generatedDocumentDelivered,
  generatedDocumentError
}: {
  leadId: string;
  status: string;
  draft: Awaited<ReturnType<typeof createLeadDraftFromTelegramMessage>>;
  generatedDocumentId?: string;
  generatedDocumentDelivered?: boolean;
  generatedDocumentError?: string;
}): string {
  const missingData = Array.isArray(draft.missingData) ? draft.missingData : [];
  const kpReady = missingData.length === 0;
  const summary = truncateTelegramLeadSummary(createTelegramLeadSummary(draft, generatedDocumentId, generatedDocumentDelivered));
  const leadDisplayName = createLeadDisplayMetadata({
    clientName: draft.clientName,
    requestType: draft.requestType,
    projectAddress: draft.projectAddress,
    leadSummary: summary
  }).displayName;
  const fields = [
    ["Lead name", leadDisplayName],
    ["Status", status],
    ["KP fields ready", kpReady ? "yes" : "no"],
    ["KP generation", generatedDocumentError],
    ["Request type", draft.requestType],
    ["Temperature", draft.temperature === "unknown" ? "" : draft.temperature],
    ["Project address", draft.projectAddress],
    ["BGF m2", draft.bgfM2 === null || draft.bgfM2 === undefined ? "" : String(draft.bgfM2)],
    ["Standard", draft.isStandard === undefined ? "" : draft.isStandard ? "yes" : "no"],
    ["Missing for KP", missingData.length > 0 ? missingData.join(", ") : ""]
  ].filter(([, value]) => String(value ?? "").trim() !== "");

  return [
    `<b>${escapeHtml(leadId)}</b> created in CRM.`,
    "",
    `Pricing: <b>${escapeHtml(createTelegramPricingBranchShortLabel(draft))}</b>${createTelegramPricingBranchShortReason(draft, missingData)}`,
    "",
    escapeHtml(summary),
    "",
    ...fields.map(([label, value]) => `${escapeHtml(String(label))}: <b>${escapeHtml(String(value))}</b>`)
  ].join("\n");
}

function createTelegramLeadSummary(
  draft: Awaited<ReturnType<typeof createLeadDraftFromTelegramMessage>>,
  generatedDocumentId: string | undefined,
  generatedDocumentDelivered: boolean | undefined
): string {
  const summary = extractTelegramRawInputValue(draft.rawInput, "Lead summary") ?? extractTelegramRawInputValue(draft.rawInput, "Summary");
  if (summary) {
    return summary;
  }

  if (generatedDocumentId) {
    return generatedDocumentDelivered ? "KP file was generated and sent to Telegram." : "KP file was generated and saved in CRM.";
  }

  return "Lead source material saved in CRM.";
}

function extractTelegramRawInputValue(rawInput: string, label: "Lead summary" | "Summary"): string | null {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escapedLabel}:\\s*(.+)$`, "im").exec(rawInput)?.[1]?.trim() ?? null;
}

function truncateTelegramLeadSummary(summary: string): string {
  const normalized = summary.replace(/\s+/g, " ").trim();
  if (normalized.length <= 300) {
    return normalized;
  }

  return `${normalized.slice(0, 297).trimEnd()}...`;
}

function createTelegramKpGenerationErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (/pdf|soffice|libreoffice|converter|conversion|export/i.test(message)) {
    return "lead created, but KP was not generated because PDF export is not configured or failed.";
  }

  if (/template/i.test(message)) {
    return "lead created, but KP was not generated because the current KP template is missing or unavailable in Settings.";
  }

  if (/missing|required/i.test(message)) {
    return "lead created, but KP was not generated because required data is missing.";
  }

  return "lead created, but KP was not generated because document generation failed.";
}
function createTelegramKpDocumentId(message: AllowedTelegramMessageBatch): string {
  return `D-telegram-${message.chatId}-${message.sourceMessageIds.at(-1) ?? message.messageId}`;
}

function createTelegramKpFieldSnapshot(draft: Awaited<ReturnType<typeof createLeadDraftFromTelegramMessage>>) {
  return {
    clientName: draft.clientName,
    requestType: draft.requestType,
    projectAddress: draft.projectAddress,
    bgfM2: draft.bgfM2,
    email: draft.email,
    phone: draft.phone,
    missingData: draft.missingData
  };
}

async function saveTelegramChannelEvent(
  config: Pick<TelegramWorkerConfig, "workspaceId" | "saveAuditEvent">,
  message: Pick<AllowedTelegramMessageBatch, "chatId">,
  event: AssistantChannelEvent
): Promise<void> {
  if (!config.saveAuditEvent) {
    return;
  }

  try {
    await config.saveAuditEvent({
      workspaceId: config.workspaceId,
      actorUserId: `telegram:${message.chatId}`,
      action: "assistant.channel.event",
      targetType: "AssistantChannelEvent",
      targetId: createTelegramChannelEventTargetId(event),
      metadata: event
    });
  } catch (error) {
    console.warn(error instanceof Error ? error.message : error);
  }
}

async function saveTelegramLeadUndoAction(
  config: Pick<TelegramWorkerConfig, "workspaceId" | "saveAuditEvent">,
  record: TelegramLeadUndoActionRecord
): Promise<void> {
  telegramUndoActionMemory.set(record.id, record);
  telegramCompletedUndoActionMemory.delete(record.id);
  telegramUndoneActionMemory.delete(record.id);

  if (!config.saveAuditEvent) {
    return;
  }

  try {
    await config.saveAuditEvent({
      workspaceId: config.workspaceId,
      actorUserId: `telegram:${record.chatId}`,
      action: "assistant.channel.event",
      targetType: "AssistantChannelEvent",
      targetId: record.id,
      metadata: {
        type: "telegram_lead_undo_action",
        ...record
      }
    });
  } catch (error) {
    console.warn(error instanceof Error ? error.message : error);
  }
}

async function markTelegramLeadUndoActionDone(
  config: Pick<TelegramWorkerConfig, "workspaceId" | "saveAuditEvent">,
  record: TelegramLeadUndoActionRecord,
  result: Record<string, unknown>
): Promise<void> {
  telegramUndoneActionMemory.add(record.id);
  telegramCompletedUndoActionMemory.set(record.id, record);

  if (!config.saveAuditEvent) {
    return;
  }

  await config.saveAuditEvent({
    workspaceId: config.workspaceId,
    actorUserId: `telegram:${record.chatId}`,
    action: "assistant.channel.event",
    targetType: "AssistantChannelEvent",
    targetId: `${record.id}:done`,
    metadata: {
      type: "telegram_lead_undo_action_done",
      undoActionId: record.id,
      actionType: record.actionType,
      ...result
    }
  });
}

async function findTelegramLeadUndoAction(
  client: TelegramWorkerPrismaLike,
  input: { workspaceId: string; chatId: string; leadId: string; actionId?: string; includeDone?: boolean }
): Promise<TelegramLeadUndoActionRecord | null> {
  const memoryRecords = input.includeDone
    ? [...telegramUndoActionMemory.values(), ...telegramCompletedUndoActionMemory.values()]
    : [...telegramUndoActionMemory.values()];
  const memoryRecord = memoryRecords
    .filter(
      (record) =>
        record.workspaceId === input.workspaceId &&
        record.chatId === input.chatId &&
        record.leadId === input.leadId &&
        (!input.actionId || record.actionId === input.actionId) &&
        (input.includeDone || !telegramUndoneActionMemory.has(record.id))
    )
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];

  if (memoryRecord) {
    return memoryRecord;
  }

  if (!client.auditLog?.findMany) {
    return null;
  }

  const rows = await client.auditLog.findMany({
    where: {
      workspaceId: input.workspaceId,
      action: "assistant.channel.event",
      targetType: "AssistantChannelEvent",
      metadata: { path: ["type"], equals: "telegram_lead_undo_action" }
    },
    orderBy: { createdAt: "desc" },
    take: 10
  });
  const doneRows = await client.auditLog.findMany({
    where: {
      workspaceId: input.workspaceId,
      action: "assistant.channel.event",
      targetType: "AssistantChannelEvent",
      metadata: { path: ["type"], equals: "telegram_lead_undo_action_done" }
    },
    orderBy: { createdAt: "desc" },
    take: 20
  });
  const doneIds = new Set(
    doneRows.flatMap((row) => {
      const metadata = row.metadata as { undoActionId?: unknown } | undefined;
      return typeof metadata?.undoActionId === "string" ? [metadata.undoActionId] : [];
    })
  );

  for (const row of rows) {
    const record = parseTelegramLeadUndoActionRecord(row.metadata);
    if (record && record.chatId === input.chatId && (!input.actionId || record.actionId === input.actionId) && (input.includeDone || !doneIds.has(record.id))) {
      return record;
    }
  }

  return null;
}

function parseTelegramLeadUndoActionRecord(metadata: unknown): TelegramLeadUndoActionRecord | null {
  if (typeof metadata !== "object" || metadata === null) {
    return null;
  }

  const candidate = metadata as TelegramLeadUndoActionRecord;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.workspaceId !== "string" ||
    typeof candidate.chatId !== "string" ||
    typeof candidate.leadId !== "string" ||
    typeof candidate.actionId !== "string" ||
    (candidate.actionType !== "create_lead" && candidate.actionType !== "update_lead")
  ) {
    return null;
  }

  return candidate;
}

function createTelegramLeadUndoActionRecord(input: {
  config: Pick<TelegramWorkerConfig, "workspaceId">;
  message: Pick<AllowedTelegramMessageBatch, "chatId" | "messageId" | "text" | "sourceMessageIds" | "receivedAt">;
  leadId: string;
  leadRecordId?: string;
  actionType: TelegramLeadUndoActionType;
  before?: Record<string, unknown>;
  draftSnapshot?: Awaited<ReturnType<typeof createLeadDraftFromTelegramMessage>>;
}): TelegramLeadUndoActionRecord {
  const actionId = String(input.message.messageId);

  return {
    id: `telegram-lead-undo:${input.message.chatId}:${input.leadId}:${actionId}`,
    workspaceId: input.config.workspaceId,
    chatId: input.message.chatId,
    actionId,
    leadId: input.leadId,
    leadRecordId: input.leadRecordId,
    actionType: input.actionType,
    before: input.before,
    draftSnapshot: input.draftSnapshot,
    sourceText: input.message.text,
    sourceMessageIds: input.message.sourceMessageIds,
    createdAt: input.message.receivedAt
  };
}

async function saveTelegramLeadEntityExtraction(
  config: Pick<TelegramWorkerConfig, "workspaceId" | "crmEntityExtractor" | "saveLeadEntityExtraction">,
  message: Pick<AllowedTelegramMessageBatch, "chatId" | "sourceMessageIds" | "receivedAt" | "attachments">,
  lead: { id?: string; leadId: string },
  text: string
): Promise<void> {
  if (!config.crmEntityExtractor || !config.saveLeadEntityExtraction || !lead.id) {
    return;
  }

  try {
    const extraction = await config.crmEntityExtractor.extract({
      channel: "telegram",
      workspaceId: config.workspaceId,
      messageId: createTelegramSourceMessageId(message),
      leadId: lead.leadId,
      text,
      receivedAt: message.receivedAt,
      attachments: (message.attachments ?? []).map((attachment) => ({
        kind: attachment.kind,
        fileName: attachment.fileName ?? attachment.fileId,
        summary: null
      }))
    });
    const plan = createCrmEntityPersistencePlan({ leadId: lead.leadId, extraction });

    await config.saveLeadEntityExtraction({
      workspaceId: config.workspaceId,
      leadRecordId: lead.id,
      leadId: lead.leadId,
      sourceChannel: "telegram",
      sourceMessageId: createTelegramSourceMessageId(message),
      actorUserId: `telegram:${message.chatId}`,
      entities: plan.entities,
      calendarActions: plan.calendarActions,
      summary: plan.historySummary
    });
  } catch (error) {
    console.warn(error instanceof Error ? error.message : error);
  }
}

function createTelegramSourceMessageId(message: Pick<AllowedTelegramMessageBatch, "chatId" | "sourceMessageIds">): string {
  return `telegram:${message.chatId}:${message.sourceMessageIds.join(",")}`;
}

function createTelegramChannelEventTargetId(event: AssistantChannelEvent): string {
  const leadOrMessageId = "leadId" in event && event.leadId ? event.leadId : "messageId" in event ? event.messageId : "none";
  return `${event.channel}:${event.type}:${event.threadId}:${leadOrMessageId}`;
}

function createTelegramThreadId(chatId: string): string {
  return `telegram:${chatId}`;
}

function createDetectedTelegramLeadFields(draft: Awaited<ReturnType<typeof createLeadDraftFromTelegramMessage>>): string[] {
  const fields = [
    ["clientName", draft.clientName],
    ["requestType", draft.requestType],
    ["projectAddress", draft.projectAddress],
    ["bgfM2", draft.bgfM2],
    ["email", draft.email],
    ["phone", draft.phone]
  ];

  return fields.flatMap(([field, value]) => (value !== null && value !== undefined && String(value).trim().length > 0 ? [String(field)] : []));
}

function createTelegramLeadDraftMessage(session: TelegramLeadDraftSession): string {
  const kpStatus = getKpRequiredFieldStatus(session.draft);

  return [
    "Lead draft",
    "",
    ...createTelegramDraftFieldLines(session),
    "",
    `Ready for KP: ${kpStatus.present.length > 0 ? kpStatus.present.join(", ") : "none yet"}`,
    `Missing for KP: ${kpStatus.missing.join(", ")}`,
    "",
    "Send the missing details in the next message. I will add them to this draft."
  ].join("\n");
}

function shouldAskClarifyingQuestionForAudio(
  draft: Awaited<ReturnType<typeof createLeadDraftFromTelegramMessage>>,
  message: TelegramLeadMessage
): boolean {
  const hasAudio = message.attachments?.some((attachment) => attachment.kind === "audio") ?? false;

  if (!hasAudio) {
    return false;
  }

  const hasCoreLeadSignal = Boolean(draft.clientName?.trim() || draft.requestType?.trim() || draft.projectAddress?.trim());
  const missingCoreFields = ["clientName", "requestType", "projectAddress"].filter((field) => draft.missingData.includes(field));

  return !hasCoreLeadSignal && missingCoreFields.length >= 2;
}

function createTelegramAmbiguousAudioClarificationMessage(): string {
  return [
    "I listened to the audio, but I am not sure what action you want.",
    "Should I create a new lead, update an existing lead, or save this as feedback?",
    "You can reply with: new lead, update lead, or feedback."
  ].join("\n");
}

function createTelegramNewLeadStartedMessage(session: TelegramLeadDraftSession): string {
  return [
    "New lead draft started.",
    "",
    ...createTelegramDraftFieldLines(session),
    "",
    "Send text, photos, or PDF documents. I will collect the fields needed for a KP."
  ].join("\n");
}

function createTelegramPossibleDifferentLeadMessage(
  activeSession: TelegramLeadDraftSession,
  draft: Awaited<ReturnType<typeof createLeadDraftFromTelegramMessage>>
): string {
  return [
    "This looks like it may be another lead.",
    "",
    `Current draft: ${activeSession.draft.clientName ?? "unknown client"} / ${activeSession.draft.projectAddress ?? "unknown address"}`,
    `New message: ${draft.clientName ?? "unknown client"} / ${draft.projectAddress ?? "unknown address"}`,
    "",
    "Please send new lead to start a separate lead, or resend the details if they should continue the current draft."
  ].join("\n");
}

function createTelegramDraftFieldLines(session: TelegramLeadDraftSession): string[] {
  const fields = [
    ["Client", session.draft.clientName],
    ["Request type", session.draft.requestType],
    ["Project address", session.draft.projectAddress],
    ["BGF m2", session.draft.bgfM2 === null || session.draft.bgfM2 === undefined ? "" : String(session.draft.bgfM2)],
    ["Email", session.draft.email],
    ["Phone", session.draft.phone]
  ].filter(([, value]) => String(value ?? "").trim() !== "");

  return fields.length > 0 ? fields.map(([label, value]) => `${label}: ${value}`) : ["No fields detected yet."];
}

async function findLeadByTelegramBotMessage(
  client: TelegramWorkerPrismaLike,
  workspaceId: string,
  chatId: string,
  messageId: number
): Promise<Awaited<ReturnType<TelegramWorkerPrismaLike["lead"]["findMany"]>>[number] | null> {
  const marker = createTelegramBotLeadMessageMarker(chatId, messageId);
  const leads = await client.lead.findMany({
    where: {
      workspaceId,
      rawInput: { contains: marker }
    },
    select: {
      id: true,
      leadId: true,
      displayName: true,
      status: true,
      temperature: true,
      rawInput: true,
      client: { select: { name: true, email: true, phone: true } },
      requestType: true,
      projectAddress: true,
      bgfM2: true,
      missingData: true,
      kpSentDate: true
    }
  });

  return leads.find((lead) => lead.rawInput?.includes(marker)) ?? null;
}

async function findLeadByTelegramReplyContext(
  client: TelegramWorkerPrismaLike,
  workspaceId: string,
  message: Pick<AllowedTelegramMessageBatch, "chatId" | "replyToMessageId" | "replyToText">
): Promise<Awaited<ReturnType<TelegramWorkerPrismaLike["lead"]["findMany"]>>[number] | null> {
  if (message.replyToMessageId !== undefined) {
    const byBotMessage = await findLeadByTelegramBotMessage(client, workspaceId, message.chatId, message.replyToMessageId);
    if (byBotMessage) {
      return byBotMessage;
    }
  }

  const leadId = extractLeadIdFromTelegramText(message.replyToText);
  if (!leadId) {
    return null;
  }

  return findLeadByLeadId(client, workspaceId, leadId);
}

async function findLeadByTelegramTextContext(
  client: TelegramWorkerPrismaLike,
  workspaceId: string,
  text: string
): Promise<Awaited<ReturnType<TelegramWorkerPrismaLike["lead"]["findMany"]>>[number] | null> {
  const leadId = extractLeadIdFromTelegramText(text);
  if (!leadId) {
    return null;
  }

  return findLeadByLeadId(client, workspaceId, leadId);
}

async function findLeadByLeadId(
  client: TelegramWorkerPrismaLike,
  workspaceId: string,
  leadId: string
): Promise<Awaited<ReturnType<TelegramWorkerPrismaLike["lead"]["findMany"]>>[number] | null> {
  const leads = await client.lead.findMany({
    where: {
      workspaceId,
      leadId
    },
    select: {
      id: true,
      leadId: true,
      displayName: true,
      status: true,
      rawInput: true,
      client: { select: { name: true, email: true, phone: true } },
      requestType: true,
      projectAddress: true,
      bgfM2: true,
      missingData: true,
      kpSentDate: true
    }
  });

  return leads.find((lead) => lead.leadId === leadId) ?? null;
}

function extractLeadIdFromTelegramText(text: string | undefined): string | null {
  return /\b(L-\d{4}-\d+)\b/i.exec(text ?? "")?.[1]?.toUpperCase() ?? null;
}

function createTelegramLeadSessionFromExistingLead(
  lead: Awaited<ReturnType<TelegramWorkerPrismaLike["lead"]["findMany"]>>[number],
  message: AllowedTelegramMessageBatch
): TelegramLeadDraftSession {
  return createTelegramLeadDraftSession({
    chatId: message.chatId,
    workspaceId: "",
    receivedAt: message.receivedAt,
    sourceMessageIds: message.sourceMessageIds,
    draft: {
      source: "telegram",
      clientName: getLeadClientName(lead),
      requestType: lead.requestType ?? null,
      projectAddress: lead.projectAddress ?? null,
      bgfM2: toOptionalNumber(lead.bgfM2),
      email: getLeadEmail(lead),
      phone: getLeadPhone(lead),
      rawInput: lead.rawInput ?? "",
      missingData: lead.missingData ?? [],
      isStandard: false,
      telegramSourceExternalId: "",
      temperature: "unknown"
    }
  });
}

function createTelegramLeadUpdateData(
  lead: Awaited<ReturnType<TelegramWorkerPrismaLike["lead"]["findMany"]>>[number],
  draft: Awaited<ReturnType<typeof createLeadDraftFromTelegramMessage>>,
  message: AllowedTelegramMessageBatch
): Record<string, unknown> {
  const renameDisplayName = extractTelegramLeadRenameDisplayName(message.text);
  const update: Record<string, unknown> = {
    rawInput: mergeTelegramLeadRawInput(lead.rawInput ?? "", draft.rawInput, message.chatId, message.sourceMessageIds)
  };

  if (renameDisplayName) {
    update.displayName = renameDisplayName;
  } else {
    addUpdateValue(update, "requestType", draft.requestType);
    addUpdateValue(update, "projectAddress", draft.projectAddress);
  }
  addUpdateValue(update, "bgfM2", draft.bgfM2);
  update.missingData = mergeLeadMissingData(lead, draft, update);
  if (
    !renameDisplayName &&
    (isMeaningfulTelegramFieldValue(draft.clientName) ||
      isMeaningfulTelegramFieldValue(draft.requestType) ||
      isMeaningfulTelegramFieldValue(draft.projectAddress))
  ) {
    Object.assign(update, createTelegramLeadDisplayData(draft, lead));
  }

  if ((update.missingData as string[]).length === 0 && lead.status === "needs_data") {
    update.status = "new";
  }

  return update;
}

function extractTelegramLeadRenameDisplayName(text: string): string | null {
  const trimmed = text.trim();
  const match =
    /\b(?:change|update|set)\s+(?:the\s+)?(?:lead|project)?\s*(?:name|title)\s+to\s+(.+)$/i.exec(trimmed) ??
    /\brename\s+(?:the\s+)?(?:lead|project)?\s*(?:to|as)\s+(.+)$/i.exec(trimmed) ??
    /(?:измени|поменяй|обнови|задай|установи)\s+(?:название|имя|заголовок)\s+(?:лида|проекта)?\s*на\s+(.+)$/iu.exec(trimmed) ??
    /(?:переименуй|назови)\s+(?:лид|проект)?\s*(?:в|на)\s+(.+)$/iu.exec(trimmed);

  return normalizeTelegramLeadRenameDisplayName(match?.[1]);
}

function normalizeTelegramLeadRenameDisplayName(value: string | undefined): string | null {
  const normalized = value
    ?.trim()
    .replace(/^["'«“”]+|["'«“”.,;:!]+$/g, "")
    .replace(/\s+/g, " ");

  return normalized && normalized.length <= 120 ? normalized : null;
}

function createTelegramLeadRestoreSnapshot(
  lead: Awaited<ReturnType<TelegramWorkerPrismaLike["lead"]["findMany"]>>[number]
): Record<string, unknown> {
  return {
    status: lead.status ?? "new",
    displayName: lead.displayName ?? null,
    rawInput: lead.rawInput ?? null,
    requestType: lead.requestType ?? null,
    projectAddress: lead.projectAddress ?? null,
    bgfM2: lead.bgfM2 ?? null,
    missingData: lead.missingData ?? []
  };
}

function createTelegramLeadDisplayData(
  draft: Awaited<ReturnType<typeof createLeadDraftFromTelegramMessage>>,
  lead?: Awaited<ReturnType<TelegramWorkerPrismaLike["lead"]["findMany"]>>[number]
): Record<string, unknown> {
  const displayMetadata = createLeadDisplayMetadata({
    clientName: draft.clientName ?? (lead ? getLeadClientName(lead) : null),
    requestType: draft.requestType ?? lead?.requestType ?? null,
    projectAddress: draft.projectAddress ?? lead?.projectAddress ?? null,
    leadSummary: draft.rawInput || lead?.rawInput || ""
  });

  return {
    displayName: displayMetadata.displayName,
    language: displayMetadata.language,
    country: displayMetadata.country,
    searchTags: displayMetadata.searchTags
  };
}

function addUpdateValue(update: Record<string, unknown>, key: string, value: string | number | null | undefined): void {
  if (isMeaningfulTelegramFieldValue(value)) {
    update[key] = value;
  }
}

function getLeadClientName(lead: Awaited<ReturnType<TelegramWorkerPrismaLike["lead"]["findMany"]>>[number]): string | null {
  return lead.client?.name ?? lead.clientName ?? null;
}

function getLeadEmail(lead: Awaited<ReturnType<TelegramWorkerPrismaLike["lead"]["findMany"]>>[number]): string | null {
  return lead.client?.email ?? lead.email ?? null;
}

function getLeadPhone(lead: Awaited<ReturnType<TelegramWorkerPrismaLike["lead"]["findMany"]>>[number]): string | null {
  return lead.client?.phone ?? lead.phone ?? null;
}

function mergeLeadMissingData(
  lead: Awaited<ReturnType<TelegramWorkerPrismaLike["lead"]["findMany"]>>[number],
  draft: Awaited<ReturnType<typeof createLeadDraftFromTelegramMessage>>,
  update: Record<string, unknown>
): string[] {
  const unresolved = new Set([...(lead.missingData ?? []), ...draft.missingData]);
  const fieldValues: Record<string, unknown> = {
    clientName: draft.clientName ?? getLeadClientName(lead),
    requestType: update.requestType ?? lead.requestType,
    projectAddress: update.projectAddress ?? lead.projectAddress,
    bgfM2: update.bgfM2 ?? lead.bgfM2,
    email: draft.email ?? getLeadEmail(lead),
    phone: draft.phone ?? getLeadPhone(lead)
  };
  for (const field of ["clientName", "requestType", "projectAddress", "bgfM2", "email", "phone"]) {
    if (isMeaningfulTelegramFieldValue(fieldValues[field])) {
      unresolved.delete(field);
    }
  }

  return Array.from(unresolved);
}

function mergeTelegramLeadRawInput(current: string, next: string, chatId: string, messageIds: number[]): string {
  return [
    current.trim(),
    `Telegram update sources: ${messageIds.map((messageId) => `telegram:${chatId}:${messageId}`).join(", ")}`,
    next.trim()
  ]
    .filter(Boolean)
    .join("\n\n--- telegram lead update ---\n\n");
}

function createTelegramLeadUpdatedMessage(
  leadId: string,
  draft: Awaited<ReturnType<typeof createLeadDraftFromTelegramMessage>>
): string {
  const fields = [
    ["Summary", createTelegramLeadSummary(draft, undefined, undefined)],
    ["Client", draft.clientName],
    ["Request type", draft.requestType],
    ["Project address", draft.projectAddress],
    ["BGF m2", draft.bgfM2 === null || draft.bgfM2 === undefined ? "" : String(draft.bgfM2)],
    ["Email", draft.email],
    ["Phone", draft.phone]
  ].filter(([, value]) => isMeaningfulTelegramFieldValue(value));

  return [
    `<b>${escapeHtml(leadId)}</b> updated in CRM.`,
    "",
    ...fields.map(([label, value]) => `${escapeHtml(String(label))}: <b>${escapeHtml(String(value))}</b>`)
  ].join("\n");
}

function isMeaningfulTelegramFieldValue(value: unknown): boolean {
  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  return Boolean(normalized) && !["unknown", "no data", "null", "undefined", "n/a", "na"].includes(normalized);
}

function filterMissingDataForKpRequiredFields(missingData: string[], requiredFields: KpRequiredField[] | undefined): string[] {
  if (!requiredFields) {
    return missingData;
  }

  const required = new Set(requiredFields);
  return missingData.filter((field) => required.has(field as KpRequiredField));
}

type TelegramTemplatePrismaLike = {
  documentTemplate?: {
    findFirst(args: unknown): Promise<{ versions?: Array<{ detectedPlaceholders?: unknown }> } | null>;
  };
};

async function resolveCurrentKpRequiredFields(client: TelegramTemplatePrismaLike, workspaceId: string): Promise<KpRequiredField[] | undefined> {
  if (!client.documentTemplate) {
    return undefined;
  }

  const template = await client.documentTemplate.findFirst({
    where: { workspaceId, documentType: "kp", isActive: true },
    orderBy: { createdAt: "desc" },
    include: {
      versions: {
        orderBy: { version: "desc" },
        take: 1
      }
    }
  });
  const placeholders = template?.versions?.[0]?.detectedPlaceholders;
  if (!Array.isArray(placeholders)) {
    return undefined;
  }

  const requiredFields = mapKpTemplatePlaceholdersToRequiredFields(placeholders);
  return requiredFields.length > 0 ? requiredFields : undefined;
}

function mapKpTemplatePlaceholdersToRequiredFields(placeholders: unknown[]): KpRequiredField[] {
  const fields = new Set<KpRequiredField>();

  for (const placeholder of placeholders) {
    switch (String(placeholder).trim()) {
      case "client_name":
        fields.add("clientName");
        break;
      case "project_address":
        fields.add("projectAddress");
        break;
      case "project_type":
        fields.add("requestType");
        break;
      case "bgf":
        fields.add("bgfM2");
        break;
    }
  }

  return Array.from(fields);
}

function createTelegramLeadUpdateClarificationMessage(
  lead: Awaited<ReturnType<TelegramWorkerPrismaLike["lead"]["findMany"]>>[number],
  draft: Awaited<ReturnType<typeof createLeadDraftFromTelegramMessage>>
): string {
  return [
    `I found lead <b>${escapeHtml(lead.leadId)}</b>, but the reply looks like it may describe a different client or address.`,
    "",
    `<b>Current</b>: ${escapeHtml(getLeadClientName(lead) ?? "unknown client")} / ${escapeHtml(lead.projectAddress ?? "unknown address")}`,
    `<b>Reply</b>: ${escapeHtml(draft.clientName ?? "unknown client")} / ${escapeHtml(draft.projectAddress ?? "unknown address")}`,
    "",
    "Please reply with: update this lead, or new lead to start a separate lead."
  ].join("\n");
}

function createEmptyTelegramLeadDraft(message: AllowedTelegramMessageBatch): Awaited<ReturnType<typeof createLeadDraftFromTelegramMessage>> {
  const sourceExternalIds = createTelegramSourceExternalIds(message);

  return {
    source: "telegram",
    clientName: null,
    email: null,
    phone: null,
    requestType: null,
    projectAddress: null,
    bgfM2: null,
    rawInput: [`Telegram sources: ${sourceExternalIds.join(", ")}`, "New lead command"].join("\n"),
    missingData: ["clientName", "requestType", "projectAddress"],
    isStandard: false,
    telegramSourceExternalId: sourceExternalIds[0] ?? "",
    temperature: "unknown"
  };
}

function createTelegramPricingBranchShortLabel(draft: Awaited<ReturnType<typeof createLeadDraftFromTelegramMessage>>): string {
  return draft.isStandard ? "standard" : "not standard";
}

function createTelegramPricingBranchShortReason(draft: Awaited<ReturnType<typeof createLeadDraftFromTelegramMessage>>, missingData: string[]): string {
  if (draft.isStandard) {
    return ".";
  }

  const reason = missingData.length > 0 ? ` - missing ${missingData.slice(0, 4).join(", ")}.` : " - needs manual pricing review.";
  return escapeHtml(reason);
}

function appendTelegramBotLeadMessageMarker(rawInput: string, chatId: string, messageId: number): string {
  return [rawInput.trim(), `Telegram lead card: ${createTelegramBotLeadMessageMarker(chatId, messageId)}`].filter(Boolean).join("\n");
}

function createTelegramBotLeadMessageMarker(chatId: string, messageId: number): string {
  return `telegram-bot:${chatId}:${messageId}`;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function toOptionalNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (value && typeof value === "object" && "toNumber" in value && typeof (value as { toNumber?: unknown }).toNumber === "function") {
    return (value as { toNumber: () => number }).toNumber();
  }

  return null;
}

function createTelegramCrmReplyMarkup(
  crmBaseUrl: string | undefined,
  leadId: string,
  kpMail?: { email?: string | null; pdfUrl?: string; docxUrl?: string; missingFields?: string[]; undoActionId?: string }
): unknown | undefined {
  if (!crmBaseUrl?.trim()) {
    return kpMail?.undoActionId ? createTelegramUndoOnlyReplyMarkup(leadId, kpMail.undoActionId) : undefined;
  }

  const actions = createLeadChatActions(
    {
      leadId,
      kpReady: (kpMail?.missingFields ?? []).length === 0,
      missingFields: kpMail?.missingFields,
      pdfUrl: isTelegramHttpUrl(kpMail?.pdfUrl) ? kpMail.pdfUrl : undefined,
      docxUrl: isTelegramHttpUrl(kpMail?.docxUrl) ? kpMail.docxUrl : undefined,
      canSendKp: Boolean(kpMail?.email?.trim()),
      clientEmail: kpMail?.email
    },
    { crmBaseUrl }
  );
  const row = actions.flatMap((action): Array<{ text: string; url: string } | { text: string; callback_data: string }> => {
    switch (action.type) {
      case "open_crm":
        return [{ text: "CRM", url: action.url }];
      case "open_pdf":
        return [{ text: "KP PDF", url: action.url }];
      case "download_doc":
        return [{ text: "KP DOC", url: action.url }];
      case "send_kp":
        return [];
      case "mark_kp_sent":
        return [];
      case "undo_kp_sent":
        return [];
    }
  });
  if (kpMail?.undoActionId) {
    row.push({ text: "Undo", callback_data: createTelegramLeadUndoCallbackData(leadId, kpMail.undoActionId) });
  }

  return {
    inline_keyboard: [row]
  };
}

function createTelegramLeadUndoCallbackData(leadId: string, actionId: string): string {
  return `lead_undo:${leadId}:${actionId}`;
}

function createTelegramLeadRecreateCallbackData(leadId: string, actionId: string): string {
  return `lead_recreate:${leadId}:${actionId}`;
}

function createTelegramLeadOpenCallbackData(leadId: string): string {
  return `lead_open:${leadId}`;
}

function createTelegramSearchNextCallbackData(offset: number): string {
  return `lead_search_next:${Math.max(0, Math.floor(offset))}`;
}

function isBareTelegramNewLeadCommand(text: string): boolean {
  const normalized = text.trim();
  return /^(?:\/newlead(?:@\w+)?|\/new(?:@\w+)?\s+lead|new\s+lead)\s*$/i.test(normalized);
}

function parseTelegramLeadActionCallbackData(
  data: string | undefined
): {
  action: "mark_kp_sent" | "undo_kp_sent" | "undo_lead_action" | "recreate_lead_from_undo" | "open_lead_card" | "search_next";
  leadId?: string;
  actionId?: string;
  offset?: number;
} | null {
  const searchNextMatch = /^lead_search_next:(\d+)$/i.exec(data?.trim() ?? "");
  if (searchNextMatch) {
    return {
      action: "search_next",
      offset: Number(searchNextMatch[1])
    };
  }

  const openMatch = /^lead_open:(L-\d{4}-\d+)$/i.exec(data?.trim() ?? "");
  if (openMatch) {
    return {
      action: "open_lead_card",
      leadId: openMatch[1].toUpperCase()
    };
  }

  const undoMatch = /^lead_undo:(L-\d{4}-\d+):(\d+)$/i.exec(data?.trim() ?? "");
  if (undoMatch) {
    return {
      action: "undo_lead_action",
      leadId: undoMatch[1].toUpperCase(),
      actionId: undoMatch[2]
    };
  }

  const recreateMatch = /^lead_recreate:(L-\d{4}-\d+):(\d+)$/i.exec(data?.trim() ?? "");
  if (recreateMatch) {
    return {
      action: "recreate_lead_from_undo",
      leadId: recreateMatch[1].toUpperCase(),
      actionId: recreateMatch[2]
    };
  }

  const match = /^lead_action:(mark_kp_sent|undo_kp_sent):(L-\d{4}-\d+)$/i.exec(data?.trim() ?? "");

  if (!match) {
    return null;
  }

  return {
    action: match[1].toLowerCase() as "mark_kp_sent" | "undo_kp_sent",
    leadId: match[2].toUpperCase()
  };
}

function isTelegramHttpUrl(value: string | undefined): value is string {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}

function createTelegramAttachmentDeliveryUrl(
  crmBaseUrl: string | undefined,
  attachmentId: string | undefined,
  download = false
): string | undefined {
  const trimmedBaseUrl = crmBaseUrl?.replace(/\/+$/, "");

  if (!trimmedBaseUrl || !attachmentId) {
    return undefined;
  }

  const url = `${trimmedBaseUrl}/documents/attachments/${encodeURIComponent(attachmentId)}`;
  return download ? `${url}?download=1` : url;
}

if (process.argv[1]?.endsWith("telegram-worker.ts")) {
  const runner = process.env.TELEGRAM_WORKER_MODE === "loop" ? runTelegramWorkerLoopFromEnv : runTelegramWorkerFromEnv;

  runner()
    .then((result) => {
      console.log(`Telegram worker processed ${result.processed}, ignored ${result.ignored}`);
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
