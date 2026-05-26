import { describe, expect, it } from "vitest";
import { createAllowedTelegramMessages, parseAllowedChatIds } from "./telegram-polling";

describe("telegram polling", () => {
  it("keeps only allowed chats and turns caption-only photo messages into lead text", () => {
    expect(parseAllowedChatIds("123, 456")).toEqual(new Set(["123", "456"]));

    expect(
      createAllowedTelegramMessages(
        [
          {
            update_id: 1,
            message: {
              message_id: 10,
              date: 1779296400,
              chat: { id: 123 },
              caption: "See attached request",
              photo: [
                { file_id: "small", width: 320, height: 240 },
                { file_id: "large", width: 1280, height: 960 }
              ]
            }
          },
          {
            update_id: 2,
            message: {
              message_id: 11,
              date: 1779296400,
              chat: { id: 999 },
              text: "Not allowed"
            }
          }
        ],
        new Set(["123"])
      )
    ).toEqual([
      {
        updateId: 1,
        messageId: 10,
        chatId: "123",
        text: "See attached request\n\n[Telegram image attachment: large]",
        receivedAt: "2026-05-20T17:00:00.000Z",
        attachments: [{ kind: "photo", sourceMessageId: 10, fileId: "large", mimeType: "image/jpeg" }]
      }
    ]);
  });

  it("accepts PDF documents and ignores non-PDF document-only messages", () => {
    expect(
      createAllowedTelegramMessages(
        [
          {
            update_id: 3,
            message: {
              message_id: 12,
              date: 1779296400,
              chat: { id: "123" },
              document: { file_id: "pdf-file", file_name: "lead.pdf", mime_type: "application/pdf" }
            }
          },
          {
            update_id: 4,
            message: {
              message_id: 13,
              date: 1779296400,
              chat: { id: "123" },
              document: { file_id: "zip-file", file_name: "archive.zip", mime_type: "application/zip" }
            }
          }
        ],
        new Set(["123"])
      ).map((message) => message.text)
    ).toEqual(["[Telegram PDF attachment: lead.pdf]"]);
  });

  it("accepts allowed Telegram voice messages as source material", () => {
    expect(
      createAllowedTelegramMessages(
        [
          {
            update_id: 50,
            message: {
              message_id: 501,
              date: 1779299000,
              chat: { id: 12345 },
              from: { id: 7, first_name: "Oleg", username: "olegp" },
              voice: { file_id: "voice-file", mime_type: "audio/ogg", duration: 18 }
            }
          }
        ],
        new Set(["12345"])
      )
    ).toEqual([
      expect.objectContaining({
        updateId: 50,
        messageId: 501,
        chatId: "12345",
        text: "[Telegram audio attachment: voice-file]",
        authorName: "Oleg",
        authorUsername: "olegp",
        attachments: [
          expect.objectContaining({
            kind: "audio",
            sourceMessageId: 501,
            fileId: "voice-file",
            fileName: "telegram-voice-501.ogg",
            mimeType: "audio/ogg"
          })
        ]
      })
    ]);
  });
});
