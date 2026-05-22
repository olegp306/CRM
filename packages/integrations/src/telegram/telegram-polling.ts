import type { TelegramLeadAttachment, TelegramLeadMessage } from "./openai-lead-parser";

export type TelegramPendingAttachment = Omit<TelegramLeadAttachment, "base64"> & {
  fileId: string;
};

export type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    date: number;
    chat: {
      id: number | string;
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
  };
};

export type AllowedTelegramMessage = Omit<TelegramLeadMessage, "attachments"> & {
  updateId: number;
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
        chatId,
        text,
        receivedAt: new Date(message.date * 1000).toISOString(),
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
  fetchImpl?: typeof fetch;
}): Promise<void> {
  const fetchImpl = config.fetchImpl ?? fetch;
  const response = await fetchImpl(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: config.chatId,
      text: config.text,
      ...(config.replyMarkup ? { reply_markup: config.replyMarkup } : {})
    })
  });

  if (!response.ok) {
    throw new Error(`Telegram sendMessage failed: ${response.status} ${response.statusText}`);
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
      fileId: document.file_id,
      fileName,
      mimeType: "application/pdf"
    });
  }

  return attachments;
}

function createTelegramLeadText(text: string, attachments: TelegramPendingAttachment[]): string {
  const trimmedText = text.trim();
  const attachmentText = attachments
    .map((attachment) => {
      if (attachment.kind === "photo") {
        return `[Telegram image attachment: ${attachment.fileId}]`;
      }

      return `[Telegram PDF attachment: ${attachment.fileName ?? attachment.fileId}]`;
    })
    .join("\n");

  return [trimmedText, attachmentText].filter(Boolean).join("\n\n");
}
