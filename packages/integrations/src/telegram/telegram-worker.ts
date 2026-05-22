import { getNextBusinessId } from "@app/core";
import { prisma as defaultPrisma } from "@app/db";
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
    findMany(args: unknown): Promise<Array<{ leadId: string; rawInput: string | null }>>;
    create(args: unknown): Promise<{ leadId: string; status: string }>;
  };
};

export type TelegramWorkerConfig = {
  allowedChatIds: Set<string>;
  botToken: string;
  workspaceId: string;
  parser: OpenAiLeadParserClient;
  crmBaseUrl?: string;
  batchWindowMs?: number;
  telegramDraftStore?: TelegramLeadDraftSessionStore;
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
  const client = config.prisma ?? defaultPrisma;
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
    await telegramDraftStore.clear({ workspaceId: config.workspaceId, chatId: message.chatId });

    await sendTelegramMessage({
      botToken: config.botToken,
      chatId: message.chatId,
      text: createTelegramLeadConfirmation({
        leadId: created.leadId,
        status: created.status,
        draft: session.draft
      }),
      replyMarkup: createTelegramCrmReplyMarkup(config.crmBaseUrl, created.leadId),
      fetchImpl
    });
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
    /^\/(start|help|about)(@\w+)?$/i.test(text) ||
    /(what can you do|help|capabilities|что ты умеешь|что умеешь|помощь|как работает)/i.test(text) ||
    text.length < 12
  );
}

function isTelegramNewLeadCommand(message: Pick<AllowedTelegramMessage, "text" | "attachments">): boolean {
  const text = message.text.trim();

  if ((message.attachments?.length ?? 0) > 0) {
    return false;
  }

  return /^\/(newlead|new_lead|lead)(@\w+)?$/i.test(text) || /^new lead$/i.test(text);
}

function createTelegramHelpMessage(): string {
  return [
    "Я умею принимать заявки на архитектурные проекты и создавать по ним лиды в CRM.",
    "",
    "Можно отправить одним скопом текст, несколько сообщений, фотографии или PDF. Я попробую разобрать это как одну заявку.",
    "",
    "Пока я не редактирую существующие записи и не отправляю КП сам. После создания лида пришлю короткую карточку и ссылку на CRM."
  ].join("\n");
}

function createTelegramLeadConfirmation({
  leadId,
  status,
  draft
}: {
  leadId: string;
  status: string;
  draft: Awaited<ReturnType<typeof createLeadDraftFromTelegramMessage>>;
}): string {
  const fields = [
    ["Lead", leadId],
    ["Status", status],
    ["KP fields ready", "yes"],
    ["Request type", draft.requestType],
    ["Temperature", draft.temperature === "unknown" ? "" : draft.temperature],
    ["Project address", draft.projectAddress],
    ["BGF m2", draft.bgfM2 === undefined ? "" : String(draft.bgfM2)],
    ["Standard", draft.isStandard === undefined ? "" : draft.isStandard ? "yes" : "no"],
    ["Missing data", Array.isArray(draft.missingData) && draft.missingData.length > 0 ? draft.missingData.join(", ") : ""]
  ].filter(([, value]) => String(value ?? "").trim() !== "");

  return ["Готово, я создал лид в CRM.", "", ...fields.map(([label, value]) => `${label}: ${value}`)].join("\n");
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

function createTelegramCrmReplyMarkup(crmBaseUrl: string | undefined, leadId: string): unknown | undefined {
  const trimmedBaseUrl = crmBaseUrl?.trim().replace(/\/$/, "");

  if (!trimmedBaseUrl) {
    return undefined;
  }

  return {
    inline_keyboard: [
      [
        {
          text: "Open in CRM",
          url: `${trimmedBaseUrl}/leads?leadId=${encodeURIComponent(leadId)}`
        }
      ]
    ]
  };
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
