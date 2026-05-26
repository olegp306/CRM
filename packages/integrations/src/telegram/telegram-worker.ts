import {
  createAssistantChannelResponse,
  createKpGeneratedEvent,
  createKpSentMarkedEvent,
  createKpSentUndoneEvent,
  createLeadChatActions,
  createLeadCreatedEvent,
  createLeadDraftUpdatedEvent,
  createLeadInteractionNoteEvent,
  createLeadInteractionNoteSummary,
  createMessageReceivedEvent,
  decideIncomingLeadMatch,
  decideLeadFlow,
  isLeadInteractionNoteCommand,
  type AssistantAuditEventDraft,
  type AssistantChannelEvent,
  type AssistantChannelMessage
} from "@app/assistant";
import { createKpSentLeadUpdate, getNextBusinessId } from "@app/core";
import { createObjectStorageFromEnv, type ObjectStorage } from "@app/core/storage";
import { createAssistantGeneratedDocumentPrismaStore, createAssistantPrismaRepository, prisma as defaultPrisma } from "@app/db";
import { createLibreOfficeDocxToPdfConverter } from "@app/documents";
import { loadRootEnv } from "../env/root-env";
import { createOpenAiAudioTranscriber, type TelegramAudioTranscriber } from "./openai-audio-transcriber";
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
        client?: { name?: string | null; email?: string | null; phone?: string | null } | null;
        clientName?: string | null;
        requestType?: string | null;
        projectAddress?: string | null;
        bgfM2?: number | null;
        email?: string | null;
        phone?: string | null;
        missingData?: string[] | null;
        kpSentDate?: Date | string | null;
      }>
    >;
    create(args: unknown): Promise<{ id?: string; leadId: string; status: string }>;
    update?(args: unknown): Promise<{ id?: string; leadId: string; status: string }>;
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
  action: "mark_kp_sent" | "undo_kp_sent";
  leadId: string;
};

type TelegramSourceAttachmentPrismaLike = {
  attachment?: {
    create(args: unknown): Promise<{ id: string }>;
  };
};

const defaultTelegramDraftStore = createMemoryTelegramLeadDraftSessionStore();

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
    const lead = await findLeadForTelegramActionCallback(client, config.workspaceId, callback);
    if (!lead || !lead.id || !client.lead.update) {
      await answerTelegramCallbackQuery({
        botToken: config.botToken,
        callbackQueryId: callback.callbackQueryId,
        text: "I could not update this lead.",
        fetchImpl
      });
      skipped += 1;
      continue;
    }

    if (callback.action === "mark_kp_sent") {
      await client.lead.update({
        where: { id: lead.id },
        data: createKpSentLeadUpdate(new Date(callback.receivedAt))
      });
      await answerTelegramCallbackQuery({
        botToken: config.botToken,
        callbackQueryId: callback.callbackQueryId,
        text: "KP marked as sent.",
        fetchImpl
      });
      await sendTelegramMessage({
        botToken: config.botToken,
        chatId: callback.chatId,
        text: `Lead <b>${escapeHtml(lead.leadId)}</b>: KP marked as sent. Follow-up planned in 7 days.`,
        parseMode: "HTML",
        fetchImpl
      });
      await saveTelegramChannelEvent(
        config,
        callback,
        createKpSentMarkedEvent({
          type: "kp_sent_marked",
          channel: "telegram",
          threadId: createTelegramThreadId(callback.chatId),
          leadId: lead.leadId
        })
      );
      processed += 1;
      continue;
    }

    await client.lead.update({
      where: { id: lead.id },
      data: {
        kpSentDate: null,
        followup1Date: null,
        followupStatus: null,
        status: "new"
      }
    });
    await answerTelegramCallbackQuery({
      botToken: config.botToken,
      callbackQueryId: callback.callbackQueryId,
      text: "KP sent mark undone.",
      fetchImpl
    });
    await sendTelegramMessage({
      botToken: config.botToken,
      chatId: callback.chatId,
      text: `Lead <b>${escapeHtml(lead.leadId)}</b>: KP sent mark was undone. We are back before sending KP.`,
      parseMode: "HTML",
      fetchImpl
    });
    await saveTelegramChannelEvent(
      config,
      callback,
      createKpSentUndoneEvent({
        type: "kp_sent_undone",
        channel: "telegram",
        threadId: createTelegramThreadId(callback.chatId),
        leadId: lead.leadId
      })
    );
    processed += 1;
  }

  for (const message of messageBatches) {
    const leadFlowDecision = decideLeadFlow(createTelegramAssistantChannelMessage(config.workspaceId, message));

    if (leadFlowDecision.kind === "start_draft" && leadFlowDecision.source === "new_lead_command") {
      const session = createTelegramLeadDraftSession({
        chatId: message.chatId,
        workspaceId: config.workspaceId,
        receivedAt: message.receivedAt,
        sourceMessageIds: message.sourceMessageIds,
        draft: createEmptyTelegramLeadDraft(message)
      });
      const sent = await sendTelegramMessage({
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
      await sendTelegramMessage({
        botToken: config.botToken,
        chatId: message.chatId,
        text: createTelegramSharedHelpMessage(config.workspaceId, message.chatId, "/start"),
        fetchImpl
      });
      skipped += message.sourceMessageIds.length;
      continue;
    }

    if (isTelegramHelpRequest(message)) {
      await sendTelegramMessage({
        botToken: config.botToken,
        chatId: message.chatId,
        text: createTelegramSharedHelpMessage(config.workspaceId, message.chatId, "/help"),
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
    const repliedLead = message.replyToMessageId
      ? await findLeadByTelegramBotMessage(client, config.workspaceId, message.chatId, message.replyToMessageId)
      : null;
    const replyLeadFlowDecision = repliedLead
      ? decideLeadFlow(
          createTelegramAssistantChannelMessage(config.workspaceId, message, {
            leadId: repliedLead.leadId,
            sourceMessageId: String(message.replyToMessageId)
          })
        )
      : null;

    if (repliedLead && isLeadInteractionNoteCommand(message.text)) {
      await saveTelegramChannelEvent(
        config,
        message,
        createLeadInteractionNoteEvent({
          type: "lead_interaction_note",
          channel: "telegram",
          threadId: createTelegramThreadId(message.chatId),
          leadId: repliedLead.leadId,
          messageId: String(message.messageId),
          summary: createLeadInteractionNoteSummary(message.text)
        })
      );
      await sendTelegramMessage({
        botToken: config.botToken,
        chatId: message.chatId,
        text: `Saved this note to lead <b>${escapeHtml(repliedLead.leadId)}</b> history.`,
        parseMode: "HTML",
        replyMarkup: createTelegramCrmOnlyReplyMarkup(config.crmBaseUrl, repliedLead.leadId),
        fetchImpl
      });
      processed += 1;
      continue;
    }

    const generalAssistantResponse = createTelegramGeneralAssistantResponse(config.workspaceId, message);
    if (generalAssistantResponse) {
      await sendTelegramMessage({
        botToken: config.botToken,
        chatId: message.chatId,
        text: generalAssistantResponse.text,
        replyMarkup: createTelegramResponseReplyMarkup(generalAssistantResponse.buttons),
        fetchImpl
      });
      skipped += message.sourceMessageIds.length;
      continue;
    }

    if (repliedLead && isTelegramKpSentCommand(message) && !isTelegramKpSentUndoCommand(message)) {
      if (!client.lead.update || !repliedLead.id) {
        await sendTelegramMessage({
          botToken: config.botToken,
          chatId: message.chatId,
          text: `I found lead <b>${escapeHtml(repliedLead.leadId)}</b>, but I cannot update it from this worker yet.`,
          parseMode: "HTML",
          fetchImpl
        });
        skipped += message.sourceMessageIds.length;
        continue;
      }

      await client.lead.update({
        where: { id: repliedLead.id },
        data: createKpSentLeadUpdate(new Date(message.receivedAt))
      });
      await sendTelegramMessage({
        botToken: config.botToken,
        chatId: message.chatId,
        text: `Lead <b>${escapeHtml(repliedLead.leadId)}</b>: KP marked as sent. Follow-up planned in 7 days.`,
        parseMode: "HTML",
        replyMarkup: createTelegramCrmOnlyReplyMarkup(config.crmBaseUrl, repliedLead.leadId),
        fetchImpl
      });
      await saveTelegramChannelEvent(
        config,
        message,
        createKpSentMarkedEvent({
          type: "kp_sent_marked",
          channel: "telegram",
          threadId: createTelegramThreadId(message.chatId),
          leadId: repliedLead.leadId
        })
      );
      processed += 1;
      continue;
    }

    if (repliedLead && isTelegramKpSentUndoCommand(message)) {
      if (!client.lead.update || !repliedLead.id) {
        await sendTelegramMessage({
          botToken: config.botToken,
          chatId: message.chatId,
          text: `I found lead <b>${escapeHtml(repliedLead.leadId)}</b>, but I cannot update it from this worker yet.`,
          parseMode: "HTML",
          fetchImpl
        });
        skipped += message.sourceMessageIds.length;
        continue;
      }

      await client.lead.update({
        where: { id: repliedLead.id },
        data: {
          kpSentDate: null,
          followup1Date: null,
          followupStatus: null,
          status: "new"
        }
      });
      await sendTelegramMessage({
        botToken: config.botToken,
        chatId: message.chatId,
        text: `Lead <b>${escapeHtml(repliedLead.leadId)}</b>: KP sent mark was undone. We are back before sending KP.`,
        parseMode: "HTML",
        replyMarkup: createTelegramCrmOnlyReplyMarkup(config.crmBaseUrl, repliedLead.leadId),
        fetchImpl
      });
      await saveTelegramChannelEvent(
        config,
        message,
        createKpSentUndoneEvent({
          type: "kp_sent_undone",
          channel: "telegram",
          threadId: createTelegramThreadId(message.chatId),
          leadId: repliedLead.leadId
        })
      );
      processed += 1;
      continue;
    }

    if (repliedLead && replyLeadFlowDecision?.kind === "not_lead_flow") {
      const response = createAssistantChannelResponse(
        createTelegramAssistantChannelMessage(config.workspaceId, message, {
          leadId: repliedLead.leadId,
          sourceMessageId: String(message.replyToMessageId)
        })
      );
      await sendTelegramMessage({
        botToken: config.botToken,
        chatId: message.chatId,
        text: response.text,
        replyMarkup: createTelegramResponseReplyMarkup(response.buttons),
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
      await sendTelegramMessage({
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

    const hydratedMessage = await hydrateTelegramLeadMessage(message, config);
    if (hasAudioTranscriptionFailure(hydratedMessage)) {
      await sendTelegramMessage({
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
    const draft = await createLeadDraftFromTelegramMessage(hydratedMessage, config.parser);

    if (!repliedLead && shouldAskClarifyingQuestionForAudio(draft, hydratedMessage)) {
      await sendTelegramMessage({
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
        await sendTelegramMessage({
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
        await sendTelegramMessage({
          botToken: config.botToken,
          chatId: message.chatId,
          text: createTelegramLeadUpdateClarificationMessage(repliedLead, draft),
          parseMode: "HTML",
          fetchImpl
        });
        skipped += message.sourceMessageIds.length;
        continue;
      }

      await client.lead.update({
        where: { id: repliedLead.id },
        data: createTelegramLeadUpdateData(repliedLead, draft, message)
      });
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
      await sendTelegramMessage({
        botToken: config.botToken,
        chatId: message.chatId,
        text: createTelegramLeadUpdatedMessage(repliedLead.leadId, draft),
        parseMode: "HTML",
        replyMarkup: createTelegramCrmOnlyReplyMarkup(config.crmBaseUrl, repliedLead.leadId),
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
    const activeSession = replySession ?? (await telegramDraftStore.getActive({ workspaceId: config.workspaceId, chatId: message.chatId }));

    if (!activeSession) {
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
          await sendTelegramMessage({
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
        await client.lead.update({
          where: { id: lead.id },
          data: createTelegramLeadUpdateData(lead, draft, message)
        });
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
        await sendTelegramMessage({
          botToken: config.botToken,
          chatId: message.chatId,
          text: createTelegramLeadUpdatedMessage(lead.leadId, draft),
          parseMode: "HTML",
          replyMarkup: createTelegramCrmOnlyReplyMarkup(config.crmBaseUrl, lead.leadId),
          fetchImpl
        });
        processed += 1;
        continue;
      }

      if (persistedLeadMatch.kind === "needs_clarification") {
        await sendTelegramMessage({
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

    if (activeSession && !replySession && isPossibleDifferentLead(activeSession, draft)) {
      await sendTelegramMessage({
        botToken: config.botToken,
        chatId: message.chatId,
        text: createTelegramPossibleDifferentLeadMessage(activeSession, draft),
        fetchImpl
      });
      skipped += message.sourceMessageIds.length;
      continue;
    }

    const session = activeSession
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

    if (!kpStatus.ready) {
      const sent = await sendTelegramMessage({
        botToken: config.botToken,
        chatId: message.chatId,
        text: createTelegramLeadDraftMessage(session),
        fetchImpl
      });
      await telegramDraftStore.save({ ...session, telegramDraftMessageId: sent.messageId ?? session.telegramDraftMessageId });
      skipped += message.sourceMessageIds.length;
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
        bgfM2: session.draft.bgfM2,
        isStandard: session.draft.isStandard,
        missingData: templateAwareMissingData,
        temperature: session.draft.temperature === "unknown" ? "hot" : session.draft.temperature
      }
    });
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

    const finalMessage = await sendTelegramMessage({
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
        docxUrl: generatedDocumentDocxUrl
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

function createTelegramExistingLeadClarificationMessage(leadId: string, matchedFields: string[]): string {
  return [
    `This may belong to lead <b>${escapeHtml(leadId)}</b>.`,
    matchedFields.length > 0 ? `Matched: ${matchedFields.map(escapeHtml).join(", ")}.` : "",
    "Please reply to that lead card if you want me to add this information there, or send /newlead to start a separate lead."
  ]
    .filter(Boolean)
    .join("\n");
}

export async function runTelegramWorkerOnce(config: TelegramWorkerConfig & { offset?: number }): Promise<TelegramWorkerResult> {
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

  const config = {
    allowedChatIds: parseAllowedChatIds(env.TELEGRAM_ALLOWED_CHAT_IDS),
    botToken,
    workspaceId: env.TELEGRAM_WORKSPACE_ID ?? "workspace-demo",
    crmBaseUrl: env.TELEGRAM_CRM_BASE_URL ?? env.NEXT_PUBLIC_APP_URL,
    generateKpDocument: createAssistantGeneratedDocumentPrismaStore(defaultPrisma, {
      objectStorage: createObjectStorageFromEnv(),
      pdfConverter: createLibreOfficeDocxToPdfConverter()
    }).create,
    saveAuditEvent: createAssistantPrismaRepository(defaultPrisma).saveAuditEvent,
    saveSourceAttachment: createTelegramSourceAttachmentStore(defaultPrisma, createObjectStorageFromEnv()).save,
    kpRequiredFields: await resolveCurrentKpRequiredFields(defaultPrisma as TelegramTemplatePrismaLike, env.TELEGRAM_WORKSPACE_ID ?? "workspace-demo"),
    audioTranscriber: createOpenAiAudioTranscriber({
      apiKey,
      model: env.OPENAI_AUDIO_TRANSCRIBE_MODEL ?? "gpt-4o-mini-transcribe"
    }),
    parser: createOpenAiLeadParserClient({
      apiKey,
      model: env.OPENAI_MODEL ?? "gpt-4o-mini"
    })
  };
  const testUpdate = createTelegramTestUpdateFromEnv(env);

  if (testUpdate) {
    return processTelegramUpdates([testUpdate], config);
  }

  return runTelegramWorkerOnce(config);
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
        leadId: parsed.leadId
      }
    ];
  });
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

function createTelegramGeneralAssistantResponse(workspaceId: string, message: Pick<AllowedTelegramMessageBatch, "chatId" | "text" | "receivedAt" | "sourceMessageIds">) {
  const response = createAssistantChannelResponse(createTelegramAssistantChannelMessage(workspaceId, message));

  if (response.intent === "capability_request" || response.shouldPersistFeedback) {
    return response;
  }

  return null;
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

function createTelegramResponseReplyMarkup(buttons: Array<{ label: string; url?: string }> = []) {
  const linkButtons = buttons.filter((button): button is { label: string; url: string } => Boolean(button.url));

  if (linkButtons.length === 0) {
    return undefined;
  }

  return {
    inline_keyboard: [linkButtons.map((button) => ({ text: button.label, url: button.url }))]
  };
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
  const fields = [
    ["Lead", leadId],
    ["Status", status],
    ["KP fields ready", "yes"],
    ["Pricing branch", createTelegramPricingBranchLabel(draft)],
    ["KP document", generatedDocumentId],
    ["KP file", generatedDocumentId ? (generatedDocumentDelivered ? "sent to Telegram" : "saved in CRM") : ""],
    ["KP generation", generatedDocumentError],
    ["Request type", draft.requestType],
    ["Temperature", draft.temperature === "unknown" ? "" : draft.temperature],
    ["Project address", draft.projectAddress],
    ["BGF m2", draft.bgfM2 === undefined ? "" : String(draft.bgfM2)],
    ["Standard", draft.isStandard === undefined ? "" : draft.isStandard ? "yes" : "no"],
    ["Missing data", Array.isArray(draft.missingData) && draft.missingData.length > 0 ? draft.missingData.join(", ") : ""]
  ].filter(([, value]) => String(value ?? "").trim() !== "");

  return [
    "Done, I created a lead in CRM.",
    "",
    `<b>${escapeHtml(createTelegramPricingBranchHeadline(draft))}</b>`,
    escapeHtml(createTelegramPricingBranchReason(draft)),
    "",
    ...fields.map(([label, value]) => `<b>${escapeHtml(String(label))}</b>: ${escapeHtml(String(value))}`)
  ].join("\n");
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

  await config.saveAuditEvent({
    workspaceId: config.workspaceId,
    actorUserId: `telegram:${message.chatId}`,
    action: "assistant.channel.event",
    targetType: "AssistantChannelEvent",
    targetId: createTelegramChannelEventTargetId(event),
    metadata: event
  });
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
    "Please send /newlead to start a separate lead, or resend the details if they should continue the current draft."
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

  return leads.find((lead) => lead.rawInput?.includes(marker)) ?? null;
}

async function findLeadForTelegramActionCallback(
  client: TelegramWorkerPrismaLike,
  workspaceId: string,
  callback: AllowedTelegramLeadActionCallback
): Promise<Awaited<ReturnType<TelegramWorkerPrismaLike["lead"]["findMany"]>>[number] | null> {
  if (callback.messageId !== undefined) {
    const byBotMessage = await findLeadByTelegramBotMessage(client, workspaceId, callback.chatId, callback.messageId);
    if (byBotMessage?.leadId === callback.leadId) {
      return byBotMessage;
    }
  }

  const leads = await client.lead.findMany({
    where: {
      workspaceId,
      leadId: callback.leadId
    },
    select: {
      id: true,
      leadId: true,
      status: true,
      rawInput: true,
      missingData: true,
      kpSentDate: true
    }
  });

  return leads.find((lead) => lead.leadId === callback.leadId) ?? null;
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
  const update: Record<string, unknown> = {
    rawInput: mergeTelegramLeadRawInput(lead.rawInput ?? "", draft.rawInput, message.chatId, message.sourceMessageIds)
  };

  addUpdateValue(update, "requestType", draft.requestType);
  addUpdateValue(update, "projectAddress", draft.projectAddress);
  addUpdateValue(update, "bgfM2", draft.bgfM2);
  update.missingData = mergeLeadMissingData(lead, draft, update);

  if ((update.missingData as string[]).length === 0 && lead.status === "needs_data") {
    update.status = "new";
  }

  return update;
}

function addUpdateValue(update: Record<string, unknown>, key: string, value: string | number | null | undefined): void {
  if (typeof value === "number" ? Number.isFinite(value) : Boolean(value?.trim())) {
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
    if (fieldValues[field] !== null && fieldValues[field] !== undefined && String(fieldValues[field]).trim().length > 0) {
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
    ["Client", draft.clientName],
    ["Request type", draft.requestType],
    ["Project address", draft.projectAddress],
    ["BGF m2", draft.bgfM2 === null || draft.bgfM2 === undefined ? "" : String(draft.bgfM2)],
    ["Email", draft.email],
    ["Phone", draft.phone]
  ].filter(([, value]) => String(value ?? "").trim() !== "");

  return [
    `Updated lead <b>${escapeHtml(leadId)}</b>.`,
    "",
    ...fields.map(([label, value]) => `<b>${escapeHtml(String(label))}</b>: ${escapeHtml(String(value))}`),
    "",
    "Reply to the lead card again if you want to add more data, mark KP sent, or undo KP sent."
  ].join("\n");
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
    "Please reply with: update this lead, or /newlead to start a separate lead."
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

function createTelegramPricingBranchLabel(draft: Awaited<ReturnType<typeof createLeadDraftFromTelegramMessage>>): string {
  return draft.isStandard ? "standard" : "custom";
}

function createTelegramPricingBranchHeadline(draft: Awaited<ReturnType<typeof createLeadDraftFromTelegramMessage>>): string {
  return draft.isStandard ? "Standard pricing branch" : "Custom pricing branch";
}

function createTelegramPricingBranchReason(draft: Awaited<ReturnType<typeof createLeadDraftFromTelegramMessage>>): string {
  if (draft.isStandard) {
    return `Standard because the parser recognized a known ${draft.requestType ?? "project"} pattern with enough KP fields. Price is selected from the configured table when BGF matches.`;
  }

  return "Custom because the request does not fully match the standard pricing path or still needs manual pricing review.";
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
  kpMail?: { email?: string | null; pdfUrl?: string; docxUrl?: string }
): unknown | undefined {
  if (!crmBaseUrl?.trim()) {
    return undefined;
  }

  const actions = createLeadChatActions(
    {
      leadId,
      kpReady: true,
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
        return [{ text: "PDF", url: action.url }];
      case "download_doc":
        return [{ text: "DOC", url: action.url }];
      case "send_kp":
        return [{ text: "Send KP", url: action.mailtoUrl }];
      case "mark_kp_sent":
        return [{ text: "Mark KP sent", callback_data: createTelegramLeadActionCallbackData("mark_kp_sent", action.leadId) }];
      case "undo_kp_sent":
        return [{ text: "Undo KP sent", callback_data: createTelegramLeadActionCallbackData("undo_kp_sent", action.leadId) }];
    }
  });

  return {
    inline_keyboard: [row]
  };
}

function createTelegramLeadActionCallbackData(action: "mark_kp_sent" | "undo_kp_sent", leadId: string): string {
  return `lead_action:${action}:${leadId}`;
}

function parseTelegramLeadActionCallbackData(data: string | undefined): { action: "mark_kp_sent" | "undo_kp_sent"; leadId: string } | null {
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
