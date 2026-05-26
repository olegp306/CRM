import type { TelegramLeadAttachment, TelegramLeadMessage } from "./openai-lead-parser";

export type TelegramPendingAttachment = Omit<TelegramLeadAttachment, "base64"> & {
  fileId: string;
  sourceMessageId: number;
};

export type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    date: number;
    chat: {
      id: number | string;
    };
    from?: {
      id: number | string;
      first_name?: string;
      last_name?: string;
      username?: string;
    };
    text?: string;
    caption?: string;
    photo?: Array<{
      file_id: string;
      file_size?: number;
      width: number;
      height: number;
    }>;
    document?: {
      file_id: string;
      file_name?: string;
      mime_type?: string;
    };
    voice?: {
      file_id: string;
      mime_type?: string;
      duration?: number;
    };
    audio?: {
      file_id: string;
      file_name?: string;
      mime_type?: string;
      duration?: number;
    };
    reply_to_message?: {
      message_id: number;
    };
  };
  callback_query?: {
    id: string;
    data?: string;
    message?: {
      message_id: number;
      date?: number;
      chat: {
        id: number | string;
      };
    };
  };
};

export type AllowedTelegramMessage = Omit<TelegramLeadMessage, "attachments"> & {
  updateId: number;
  replyToMessageId?: number;
  attachments?: TelegramPendingAttachment[];
};

type TelegramGetUpdatesResponse = {
  ok: boolean;
  result: TelegramUpdate[];
};

export function parseAllowedChatIds(value = ""): Set<string> {
  return new Set(
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

export function createAllowedTelegramMessages(updates: TelegramUpdate[], allowedChatIds: Set<string>): AllowedTelegramMessage[] {
  return updates.flatMap((update) => {
    const message = update.message;
    const chatId = message ? String(message.chat.id) : "";
    const attachments = message ? createTelegramPendingAttachments(message) : [];
    const text = message ? createTelegramLeadText(message.text ?? message.caption ?? "", attachments) : "";

    if (!message || !text || !allowedChatIds.has(chatId)) {
      return [];
    }

    return [
      {
        updateId: update.update_id,
        messageId: message.message_id,
        replyToMessageId: message.reply_to_message?.message_id,
        chatId,
        text,
        receivedAt: new Date(message.date * 1000).toISOString(),
        ...createTelegramAuthor(message),
        ...(attachments.length > 0 ? { attachments } : {})
      }
    ];
  });
}

export async function fetchTelegramUpdates(config: {
  botToken: string;
  offset?: number;
  fetchImpl?: typeof fetch;
}): Promise<TelegramUpdate[]> {
  const fetchImpl = config.fetchImpl ?? fetch;
  const params = new URLSearchParams({ timeout: "0" });

  if (config.offset !== undefined) {
    params.set("offset", String(config.offset));
  }

  const response = await fetchImpl(`https://api.telegram.org/bot${config.botToken}/getUpdates?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Telegram getUpdates failed: ${response.status} ${response.statusText}`);
  }

  const body = (await response.json()) as TelegramGetUpdatesResponse;
  if (!body.ok) {
    throw new Error("Telegram getUpdates returned ok=false");
  }

  return body.result;
}

export async function sendTelegramMessage(config: {
  botToken: string;
  chatId: string;
  text: string;
  replyMarkup?: unknown;
  parseMode?: "HTML";
  fetchImpl?: typeof fetch;
}): Promise<{ messageId?: number }> {
  const fetchImpl = config.fetchImpl ?? fetch;
  const response = await fetchImpl(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: config.chatId,
      text: config.text,
      ...(config.parseMode ? { parse_mode: config.parseMode } : {}),
      ...(config.replyMarkup ? { reply_markup: config.replyMarkup } : {})
    })
  });

  if (!response.ok) {
    throw new Error(`Telegram sendMessage failed: ${response.status} ${response.statusText}`);
  }

  const body = (await response.json()) as { ok?: boolean; result?: { message_id?: number } };

  return { messageId: body.result?.message_id };
}

export async function answerTelegramCallbackQuery(config: {
  botToken: string;
  callbackQueryId: string;
  text?: string;
  fetchImpl?: typeof fetch;
}): Promise<void> {
  const fetchImpl = config.fetchImpl ?? fetch;
  const response = await fetchImpl(`https://api.telegram.org/bot${config.botToken}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callback_query_id: config.callbackQueryId,
      ...(config.text ? { text: config.text } : {})
    })
  });

  if (!response.ok) {
    throw new Error(`Telegram answerCallbackQuery failed: ${response.status} ${response.statusText}`);
  }
}

export async function sendTelegramDocument(config: {
  botToken: string;
  chatId: string;
  document: string;
  caption?: string;
  fetchImpl?: typeof fetch;
}): Promise<void> {
  const fetchImpl = config.fetchImpl ?? fetch;
  const response = await fetchImpl(`https://api.telegram.org/bot${config.botToken}/sendDocument`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: config.chatId,
      document: config.document,
      ...(config.caption ? { caption: config.caption } : {})
    })
  });

  if (!response.ok) {
    throw new Error(`Telegram sendDocument failed: ${response.status} ${response.statusText}`);
  }
}

function createTelegramPendingAttachments(message: NonNullable<TelegramUpdate["message"]>): TelegramPendingAttachment[] {
  const attachments: TelegramPendingAttachment[] = [];
  const largestPhoto = message.photo
    ? [...message.photo].sort((left, right) => (right.file_size ?? right.width * right.height) - (left.file_size ?? left.width * left.height))[0]
    : undefined;

  if (largestPhoto) {
    attachments.push({
      kind: "photo",
      sourceMessageId: message.message_id,
      fileId: largestPhoto.file_id,
      mimeType: "image/jpeg"
    });
  }

  const document = message.document;
  const fileName = document?.file_name ?? "telegram-document.pdf";
  const mimeType = document?.mime_type ?? "";

  if (document && (mimeType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf"))) {
    attachments.push({
      kind: "pdf",
      sourceMessageId: message.message_id,
      fileId: document.file_id,
      fileName,
      mimeType: "application/pdf"
    });
  }

  if (document && isTelegramAudioDocument(fileName, mimeType)) {
    attachments.push({
      kind: "audio",
      sourceMessageId: message.message_id,
      fileId: document.file_id,
      fileName,
      mimeType: mimeType || inferTelegramAudioMimeType(fileName)
    });
  }

  if (message.voice) {
    attachments.push({
      kind: "audio",
      sourceMessageId: message.message_id,
      fileId: message.voice.file_id,
      fileName: `telegram-voice-${message.message_id}.ogg`,
      mimeType: message.voice.mime_type ?? "audio/ogg"
    });
  }

  if (message.audio) {
    attachments.push({
      kind: "audio",
      sourceMessageId: message.message_id,
      fileId: message.audio.file_id,
      fileName: message.audio.file_name ?? `telegram-audio-${message.message_id}.ogg`,
      mimeType: message.audio.mime_type ?? "application/octet-stream"
    });
  }

  return attachments;
}

function isTelegramAudioDocument(fileName: string, mimeType: string): boolean {
  const lowerFileName = fileName.toLowerCase();

  return (
    mimeType.toLowerCase().startsWith("audio/") ||
    [".mp3", ".m4a", ".ogg", ".oga", ".wav", ".webm", ".mp4", ".mpeg", ".mpga"].some((extension) => lowerFileName.endsWith(extension))
  );
}

function inferTelegramAudioMimeType(fileName: string): string {
  const lowerFileName = fileName.toLowerCase();

  if (lowerFileName.endsWith(".mp3") || lowerFileName.endsWith(".mpeg") || lowerFileName.endsWith(".mpga")) {
    return "audio/mpeg";
  }

  if (lowerFileName.endsWith(".m4a") || lowerFileName.endsWith(".mp4")) {
    return "audio/mp4";
  }

  if (lowerFileName.endsWith(".wav")) {
    return "audio/wav";
  }

  if (lowerFileName.endsWith(".webm")) {
    return "audio/webm";
  }

  return "audio/ogg";
}

function createTelegramAuthor(message: NonNullable<TelegramUpdate["message"]>): Pick<AllowedTelegramMessage, "authorName" | "authorUsername"> {
  const authorName = [message.from?.first_name, message.from?.last_name].filter(Boolean).join(" ").trim();

  return {
    ...(authorName ? { authorName } : {}),
    ...(message.from?.username ? { authorUsername: message.from.username } : {})
  };
}

function createTelegramLeadText(text: string, attachments: TelegramPendingAttachment[]): string {
  const trimmedText = text.trim();
  const attachmentText = attachments
    .map((attachment) => {
      if (attachment.kind === "photo") {
        return `[Telegram image attachment: ${attachment.fileId}]`;
      }

      if (attachment.kind === "audio") {
        return `[Telegram audio attachment: ${attachment.fileId}]`;
      }

      return `[Telegram PDF attachment: ${attachment.fileName ?? attachment.fileId}]`;
    })
    .join("\n");

  return [trimmedText, attachmentText].filter(Boolean).join("\n\n");
}
