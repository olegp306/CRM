import { createKpSentLeadUpdate, getNextBusinessId } from "@app/core";
import { createObjectStorageFromEnv } from "@app/core/storage";
import { createAssistantGeneratedDocumentPrismaStore, prisma as defaultPrisma } from "@app/db";
import { loadRootEnv } from "../env/root-env";
import {
  createLeadDraftFromTelegramMessage,
  createOpenAiLeadParserClient,
  createTelegramSourceExternalIds,
  type OpenAiLeadParserClient,
  type TelegramLeadAttachment,
  type TelegramLeadMessage
} from "./openai-lead-parser";
import {
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
  type TelegramLeadDraftSession,
  type TelegramLeadDraftSessionStore
} from "./telegram-lead-draft-session";

export type TelegramWorkerPrismaLike = {
  lead: {
    findMany(
      args: unknown
    ): Promise<
      Array<{
        id?: string;
        leadId: string;
        status?: string | null;
        rawInput: string | null;
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

export type TelegramWorkerConfig = {
  allowedChatIds: Set<string>;
  botToken: string;
  workspaceId: string;
  parser: OpenAiLeadParserClient;
  crmBaseUrl?: string;
  batchWindowMs?: number;
  telegramDraftStore?: TelegramLeadDraftSessionStore;
  generateKpDocument?: (input: TelegramGenerateKpDocumentInput) => Promise<TelegramGeneratedKpDocumentRecord>;
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
  const allowedMessages = createAllowedTelegramMessages(updates, config.allowedChatIds);
  const messageBatches = createAllowedTelegramMessageBatches(allowedMessages, config.batchWindowMs);
  let processed = 0;
  let skipped = 0;

  for (const message of messageBatches) {
    if (isTelegramNewLeadCommand(message)) {
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
        text: createTelegramWelcomeMessage(),
        fetchImpl
      });
      skipped += message.sourceMessageIds.length;
      continue;
    }

    if (isTelegramHelpRequest(message)) {
      await sendTelegramMessage({
        botToken: config.botToken,
        chatId: message.chatId,
        text: createTelegramHelpMessage(),
        fetchImpl
      });
      skipped += message.sourceMessageIds.length;
      continue;
    }

    const sourceExternalIds = createTelegramSourceExternalIds(message);
    const repliedLead = message.replyToMessageId
      ? await findLeadByTelegramBotMessage(client, config.workspaceId, message.chatId, message.replyToMessageId)
      : null;

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
        fetchImpl
      });
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
        fetchImpl
      });
      processed += 1;
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

    if (existingLeads.some((lead) => sourceExternalIds.some((sourceExternalId) => lead.rawInput?.includes(sourceExternalId)))) {
      skipped += message.sourceMessageIds.length;
      continue;
    }

    const hydratedMessage = await hydrateTelegramLeadMessage(message, config);
    const existingIds = await client.lead.findMany({
      where: { workspaceId: config.workspaceId },
      select: { leadId: true, rawInput: true }
    });
    const draft = await createLeadDraftFromTelegramMessage(hydratedMessage, config.parser);

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
      await sendTelegramMessage({
        botToken: config.botToken,
        chatId: message.chatId,
        text: createTelegramLeadUpdatedMessage(repliedLead.leadId, draft),
        parseMode: "HTML",
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
    const kpStatus = getKpRequiredFieldStatus(session.draft);

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
    const created = await client.lead.create({
      data: {
        workspaceId: config.workspaceId,
        leadId,
        status: session.draft.missingData.length > 0 ? "needs_data" : "new",
        rawInput: session.draft.rawInput,
        requestType: session.draft.requestType,
        projectAddress: session.draft.projectAddress,
        bgfM2: session.draft.bgfM2,
        isStandard: session.draft.isStandard,
        missingData: session.draft.missingData,
        temperature: session.draft.temperature === "unknown" ? "hot" : session.draft.temperature
      }
    });
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
          fieldSnapshot: createTelegramKpFieldSnapshot(session.draft),
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
      objectStorage: createObjectStorageFromEnv()
    }).create,
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
  if (!message.attachments?.length) {
    return {
    chatId: message.chatId,
    messageId: message.messageId,
    sourceMessageIds: "sourceMessageIds" in message ? (message.sourceMessageIds as number[]) : [message.messageId],
    receivedAt: message.receivedAt,
    text: message.text
    };
  }

  return {
    chatId: message.chatId,
    messageId: message.messageId,
    sourceMessageIds: "sourceMessageIds" in message ? (message.sourceMessageIds as number[]) : [message.messageId],
    receivedAt: message.receivedAt,
    text: message.text,
    attachments: await Promise.all(message.attachments.map((attachment) => downloadTelegramAttachment(attachment, config)))
  };
}

async function downloadTelegramAttachment(
  attachment: TelegramPendingAttachment,
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

  return {
    kind: attachment.kind,
    mimeType: attachment.mimeType,
    fileName: attachment.fileName,
    base64: Buffer.from(await fileResponse.arrayBuffer()).toString("base64")
  };
}

function defaultSleep(intervalMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, intervalMs));
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

function isTelegramNewLeadCommand(message: Pick<AllowedTelegramMessage, "text" | "attachments">): boolean {
  const text = message.text.trim();

  if ((message.attachments?.length ?? 0) > 0) {
    return false;
  }

  return /^\/(newlead|new_lead|lead)(@\w+)?$/i.test(text) || /^new lead$/i.test(text);
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

function createTelegramHelpMessage(): string {
  return [
    "Я умею принимать заявки на архитектурные проекты и создавать по ним лиды в CRM.",
    "",
    "Можно отправить одним скопом текст, несколько сообщений, фотографии или PDF. Я попробую разобрать это как одну заявку.",
    "",
    "Ответом на карточку лида можно добавить недостающие данные, приложить материалы, отметить КП отправленным или отменить отправку КП. Если я не пойму действие, задам короткий уточняющий вопрос."
  ].join("\n");
}

function createTelegramWelcomeMessage(): string {
  return [
    "Здравствуйте! Я CRM-помощник Олега для архитектурных заявок.",
    "",
    "Я могу принять сообщение, фото или PDF из Telegram, разобрать заявку, создать лид в CRM, подготовить КП и дать ссылки на карточку лида и документы.",
    "",
    "Если отвечать reply на карточку лида, я смогу добавить недостающие данные, отметить КП отправленным или отменить эту отметку.",
    "",
    "Присылайте первую заявку свободным текстом. Мы очень ждём ваших впечатлений и замечаний: они помогают быстро сделать систему удобнее."
  ].join("\n");
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
      clientName: true,
      requestType: true,
      projectAddress: true,
      bgfM2: true,
      email: true,
      phone: true,
      missingData: true,
      kpSentDate: true
    }
  });

  return leads.find((lead) => lead.rawInput?.includes(marker)) ?? null;
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
      clientName: lead.clientName ?? null,
      requestType: lead.requestType ?? null,
      projectAddress: lead.projectAddress ?? null,
      bgfM2: toOptionalNumber(lead.bgfM2),
      email: lead.email ?? null,
      phone: lead.phone ?? null,
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

  addUpdateValue(update, "clientName", draft.clientName);
  addUpdateValue(update, "requestType", draft.requestType);
  addUpdateValue(update, "projectAddress", draft.projectAddress);
  addUpdateValue(update, "bgfM2", draft.bgfM2);
  addUpdateValue(update, "email", draft.email);
  addUpdateValue(update, "phone", draft.phone);
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

function mergeLeadMissingData(
  lead: Awaited<ReturnType<TelegramWorkerPrismaLike["lead"]["findMany"]>>[number],
  draft: Awaited<ReturnType<typeof createLeadDraftFromTelegramMessage>>,
  update: Record<string, unknown>
): string[] {
  const unresolved = new Set([...(lead.missingData ?? []), ...draft.missingData]);
  for (const field of ["clientName", "requestType", "projectAddress", "bgfM2", "email", "phone"]) {
    if ((update[field] ?? lead[field as keyof typeof lead]) !== null && (update[field] ?? lead[field as keyof typeof lead]) !== undefined) {
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

function createTelegramLeadUpdateClarificationMessage(
  lead: Awaited<ReturnType<TelegramWorkerPrismaLike["lead"]["findMany"]>>[number],
  draft: Awaited<ReturnType<typeof createLeadDraftFromTelegramMessage>>
): string {
  return [
    `I found lead <b>${escapeHtml(lead.leadId)}</b>, but the reply looks like it may describe a different client or address.`,
    "",
    `<b>Current</b>: ${escapeHtml(lead.clientName ?? "unknown client")} / ${escapeHtml(lead.projectAddress ?? "unknown address")}`,
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
  const trimmedBaseUrl = crmBaseUrl?.trim().replace(/\/$/, "");

  if (!trimmedBaseUrl) {
    return undefined;
  }

  const row: Array<{ text: string; url: string }> = [
    {
      text: "Open in CRM",
      url: `${trimmedBaseUrl}/leads?leadId=${encodeURIComponent(leadId)}`
    }
  ];

  if (isTelegramHttpUrl(kpMail?.pdfUrl)) {
    row.push({
      text: "Open KP PDF",
      url: kpMail.pdfUrl
    });
  }

  if (isTelegramHttpUrl(kpMail?.docxUrl)) {
    row.push({
      text: "Download KP DOCX",
      url: kpMail.docxUrl
    });
  }

  return {
    inline_keyboard: [row]
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
