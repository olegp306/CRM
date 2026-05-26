import { describe, expect, it, vi } from "vitest";
import type { OpenAiLeadParserClient } from "./openai-lead-parser";
import { createTelegramTestUpdateFromEnv, processTelegramUpdates, runTelegramWorkerLoop } from "./telegram-worker";
import { createMemoryTelegramLeadDraftSessionStore } from "./telegram-lead-draft-session";

describe("telegram worker", () => {
  it("creates a synthetic Telegram update from local test env", () => {
    expect(
      createTelegramTestUpdateFromEnv({
        TELEGRAM_TEST_MESSAGE: "Hallo, wir brauchen ein EFH Angebot.",
        TELEGRAM_TEST_CHAT_ID: "777",
        TELEGRAM_TEST_MESSAGE_ID: "42",
        TELEGRAM_TEST_RECEIVED_AT: "2026-05-20T18:00:00.000Z"
      })
    ).toEqual({
      update_id: 42,
      message: {
        message_id: 42,
        date: 1779300000,
        chat: { id: 777 },
        text: "Hallo, wir brauchen ein EFH Angebot."
      }
    });
  });

  it("creates one CRM lead from an allowed Telegram message and sends a confirmation", async () => {
    const created: unknown[] = [];
    const client = {
      lead: {
        findMany: vi.fn(async () => [{ leadId: "L-2026-001", rawInput: "old" }]),
        create: vi.fn(async (args: unknown) => {
          created.push(args);
          return { id: "lead-record-2", leadId: "L-2026-002", status: "new" };
        })
      }
    };
    const parser: OpenAiLeadParserClient = {
      parseLead: vi.fn(async () => ({
        clientName: "Fam. Schneider",
        requestType: "new_build",
        urgency: "high" as const,
        temperature: "hot" as const,
        bgfM2: 160,
        projectAddress: "Chiemseeufer 7",
        email: "fam@example.com",
        phone: "+49 170 123456",
        missingData: [],
        summary: "Standard EFH lead",
        suggestedReply: "Danke."
      }))
    };
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/sendMessage")) {
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }

      throw new Error(`Unexpected URL ${url}`);
    });

    await expect(
      processTelegramUpdates(
        [
          {
            update_id: 10,
            message: {
              message_id: 5,
              date: 1779296400,
              chat: { id: 12345 },
              text: "Need EFH offer"
            }
          }
        ],
        {
          allowedChatIds: new Set(["12345"]),
          botToken: "telegram-token",
          workspaceId: "workspace-demo",
          parser,
          prisma: client,
          fetchImpl: fetchMock as unknown as typeof fetch
        }
      )
    ).resolves.toEqual({ processed: 1, ignored: 0, lastUpdateId: 10 });

    expect(created).toEqual([
      {
        data: expect.objectContaining({
          workspaceId: "workspace-demo",
          leadId: "L-2026-002",
          status: "new",
          temperature: "hot",
          requestType: "new_build",
          projectAddress: "Chiemseeufer 7",
          bgfM2: 160,
          rawInput: expect.stringContaining("Telegram sources: telegram:12345:5")
        })
      }
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.telegram.org/bottelegram-token/sendMessage",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("Done, I created a lead in CRM.")
      })
    );
  });

  it("answers theme capability questions without parsing them as leads", async () => {
    const client = {
      lead: {
        findMany: vi.fn(async () => []),
        create: vi.fn()
      }
    };
    const parser: OpenAiLeadParserClient = {
      parseLead: vi.fn()
    };
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/sendMessage")) {
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }

      throw new Error(`Unexpected URL ${url}`);
    });

    await expect(
      processTelegramUpdates(
        [
          {
            update_id: 12,
            message: {
              message_id: 7,
              date: 1779296400,
              chat: { id: 12345 },
              text: "а есть цветовая схема или тема темная для вечера ?"
            }
          }
        ],
        {
          allowedChatIds: new Set(["12345"]),
          botToken: "telegram-token",
          workspaceId: "workspace-demo",
          parser,
          prisma: client,
          fetchImpl: fetchMock as unknown as typeof fetch
        }
      )
    ).resolves.toEqual({ processed: 0, ignored: 1, lastUpdateId: 12 });

    expect(parser.parseLead).not.toHaveBeenCalled();
    expect(client.lead.create).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.telegram.org/bottelegram-token/sendMessage",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("Nocturne")
      })
    );
  });

  it("groups nearby Telegram messages from one chat into one CRM lead and adds a CRM button", async () => {
    const created: unknown[] = [];
    const client = {
      lead: {
        findMany: vi.fn(async () => [{ leadId: "L-2026-001", rawInput: "old" }]),
        create: vi.fn(async (args: unknown) => {
          created.push(args);
          return { id: "lead-record-2", leadId: "L-2026-002", status: "needs_data" };
        })
      }
    };
    const parser: OpenAiLeadParserClient = {
      parseLead: vi.fn(async (input) => ({
        clientName: "Katya",
        requestType: "renovation",
        urgency: "medium" as const,
        temperature: "warm" as const,
        projectAddress: "Berlin",
        email: null,
        phone: null,
        missingData: ["budget"],
        summary: input.text,
        suggestedReply: "Спасибо."
      }))
    };
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/sendMessage")) {
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }

      throw new Error(`Unexpected URL ${url}`);
    });

    await expect(
      processTelegramUpdates(
        [
          {
            update_id: 10,
            message: {
              message_id: 5,
              date: 1779296400,
              chat: { id: 12345 },
              text: "Need renovation"
            }
          },
          {
            update_id: 11,
            message: {
              message_id: 6,
              date: 1779296460,
              chat: { id: 12345 },
              text: "Address Berlin"
            }
          }
        ],
        {
          allowedChatIds: new Set(["12345"]),
          botToken: "telegram-token",
          workspaceId: "workspace-demo",
          crmBaseUrl: "https://crm.example.com",
          parser,
          prisma: client,
          fetchImpl: fetchMock as unknown as typeof fetch
        }
      )
    ).resolves.toEqual({ processed: 1, ignored: 0, lastUpdateId: 11 });

    expect(parser.parseLead).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining("Need renovation")
      })
    );
    expect(parser.parseLead).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining("Address Berlin")
      })
    );
    expect(created).toEqual([
      {
        data: expect.objectContaining({
          rawInput: expect.stringContaining("Telegram sources: telegram:12345:5, telegram:12345:6")
        })
      }
    ]);
    const sendCall = fetchMock.mock.calls.at(-1) as unknown as [string, { body?: unknown }];
    const sendBody = JSON.parse(String(sendCall[1]?.body));
    expect(sendBody.text).toContain("<b>Missing data</b>: budget");
    expect(sendBody.reply_markup.inline_keyboard[0][0]).toEqual({
      text: "CRM",
      url: "https://crm.example.com/leads?leadId=L-2026-002"
    });
  });

  it("transcribes a Telegram voice message before creating a CRM lead", async () => {
    const created: unknown[] = [];
    const client = {
      lead: {
        findMany: vi.fn(async () => []),
        create: vi.fn(async (args: unknown) => {
          created.push(args);
          return { id: "lead-record-voice", leadId: "L-2026-001", status: "new" };
        })
      }
    };
    const parser: OpenAiLeadParserClient = {
      parseLead: vi.fn(async (input) => ({
        clientName: "Oleg Voice",
        requestType: "new_build",
        urgency: "high" as const,
        temperature: "hot" as const,
        bgfM2: 190,
        projectAddress: "Gartenweg 9",
        email: "voice@example.com",
        phone: "+49 170 123456",
        missingData: [],
        summary: input.text,
        suggestedReply: "Ready."
      }))
    };
    const audioTranscriber = {
      transcribe: vi.fn(async () => ({ text: "Нужен проект дома Gartenweg 9, BGF 190, бюджет 32000 EUR." }))
    };
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/getFile")) {
        return { ok: true, status: 200, json: async () => ({ ok: true, result: { file_path: "voice/file_501.ogg" } }) };
      }

      if (url.includes("/file/")) {
        return { ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode("voice bytes").buffer };
      }

      if (url.includes("/sendMessage")) {
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }

      throw new Error(`Unexpected URL ${url}`);
    });

    await expect(
      processTelegramUpdates(
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
        {
          allowedChatIds: new Set(["12345"]),
          botToken: "telegram-token",
          workspaceId: "workspace-demo",
          parser,
          prisma: client,
          audioTranscriber,
          fetchImpl: fetchMock as unknown as typeof fetch
        }
      )
    ).resolves.toEqual({ processed: 1, ignored: 0, lastUpdateId: 50 });

    expect(audioTranscriber.transcribe).toHaveBeenCalledWith(
      expect.objectContaining({
        base64: Buffer.from("voice bytes").toString("base64"),
        mimeType: "audio/ogg",
        fileName: "telegram-voice-501.ogg"
      })
    );
    expect(parser.parseLead).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining("Audio transcript 1 (telegram-voice-501.ogg):")
      })
    );
    expect(parser.parseLead).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining("Author: Oleg (@olegp)")
      })
    );
    expect(created[0]).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          rawInput: expect.stringContaining("Telegram attachment 1: audio (telegram-voice-501.ogg, source voice-file)")
        })
      })
    );
    expect(created[0]).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          rawInput: expect.stringContaining("Нужен проект дома Gartenweg 9")
        })
      })
    );
  });

  it("combines nearby Telegram photos and voice transcripts into one lead", async () => {
    const created: unknown[] = [];
    const client = {
      lead: {
        findMany: vi.fn(async () => []),
        create: vi.fn(async (args: unknown) => {
          created.push(args);
          return { id: "lead-record-mixed", leadId: "L-2026-001", status: "new" };
        })
      }
    };
    const parser: OpenAiLeadParserClient = {
      parseLead: vi.fn(async (input) => ({
        clientName: "Mixed Source",
        requestType: "renovation",
        urgency: "medium" as const,
        temperature: "warm" as const,
        bgfM2: 145,
        projectAddress: "Seestrasse 2",
        email: null,
        phone: null,
        missingData: [],
        summary: input.text,
        suggestedReply: "Ready."
      }))
    };
    const audioTranscriber = {
      transcribe: vi.fn(async () => ({ text: "На фото планировка, адрес Seestrasse 2, площадь 145 м2." }))
    };
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/getFile") && url.includes("photo-large")) {
        return { ok: true, status: 200, json: async () => ({ ok: true, result: { file_path: "photos/photo-large.jpg" } }) };
      }

      if (url.includes("/getFile") && url.includes("voice-file")) {
        return { ok: true, status: 200, json: async () => ({ ok: true, result: { file_path: "voice/file_502.ogg" } }) };
      }

      if (url.includes("/file/")) {
        return { ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode(String(url)).buffer };
      }

      if (url.includes("/sendMessage")) {
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }

      throw new Error(`Unexpected URL ${url}`);
    });

    await expect(
      processTelegramUpdates(
        [
          {
            update_id: 51,
            message: {
              message_id: 501,
              date: 1779299000,
              chat: { id: 12345 },
              caption: "Планировка",
              photo: [{ file_id: "photo-large", width: 1280, height: 960 }]
            }
          },
          {
            update_id: 52,
            message: {
              message_id: 502,
              date: 1779299060,
              chat: { id: 12345 },
              voice: { file_id: "voice-file", mime_type: "audio/ogg" }
            }
          }
        ],
        {
          allowedChatIds: new Set(["12345"]),
          botToken: "telegram-token",
          workspaceId: "workspace-demo",
          parser,
          prisma: client,
          audioTranscriber,
          fetchImpl: fetchMock as unknown as typeof fetch
        }
      )
    ).resolves.toEqual({ processed: 1, ignored: 0, lastUpdateId: 52 });

    expect(parser.parseLead).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining("[Telegram image attachment: photo-large]")
      })
    );
    expect(parser.parseLead).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining("Audio transcript 2 (telegram-voice-502.ogg):")
      })
    );
    expect(created[0]).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          rawInput: expect.stringContaining("Telegram sources: telegram:12345:501, telegram:12345:502")
        })
      })
    );
  });

  it("asks a clarification question for ambiguous Telegram audio instead of creating a lead", async () => {
    const client = {
      lead: {
        findMany: vi.fn(async () => []),
        create: vi.fn()
      }
    };
    const parser: OpenAiLeadParserClient = {
      parseLead: vi.fn(async () => ({
        clientName: "",
        requestType: "",
        urgency: "medium" as const,
        temperature: "unknown" as const,
        bgfM2: undefined,
        projectAddress: undefined,
        email: null,
        phone: null,
        missingData: ["clientName", "requestType", "projectAddress"],
        summary: "Unclear casual audio.",
        suggestedReply: "Please clarify."
      }))
    };
    const audioTranscriber = {
      transcribe: vi.fn(async () => ({ text: "Я не уверен, что с этим нужно сделать, просто посмотри потом." }))
    };
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/getFile")) {
        return { ok: true, status: 200, json: async () => ({ ok: true, result: { file_path: "voice/file_503.ogg" } }) };
      }

      if (url.includes("/file/")) {
        return { ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode("unclear voice").buffer };
      }

      if (url.includes("/sendMessage")) {
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }

      throw new Error(`Unexpected URL ${url}`);
    });

    await expect(
      processTelegramUpdates(
        [
          {
            update_id: 53,
            message: {
              message_id: 503,
              date: 1779299120,
              chat: { id: 12345 },
              voice: { file_id: "voice-file", mime_type: "audio/ogg" }
            }
          }
        ],
        {
          allowedChatIds: new Set(["12345"]),
          botToken: "telegram-token",
          workspaceId: "workspace-demo",
          parser,
          prisma: client,
          audioTranscriber,
          fetchImpl: fetchMock as unknown as typeof fetch
        }
      )
    ).resolves.toEqual({ processed: 0, ignored: 1, lastUpdateId: 53 });

    expect(client.lead.create).not.toHaveBeenCalled();
    const sendCall = fetchMock.mock.calls.at(-1) as unknown as [string, { body?: unknown }];
    expect(JSON.parse(String(sendCall[1]?.body)).text).toContain("Should I create a new lead, update an existing lead, or save this as feedback?");
  });

  it("asks for a resend when Telegram audio transcription fails", async () => {
    const client = {
      lead: {
        findMany: vi.fn(async () => []),
        create: vi.fn()
      }
    };
    const parser: OpenAiLeadParserClient = {
      parseLead: vi.fn()
    };
    const audioTranscriber = {
      transcribe: vi.fn(async () => {
        throw new Error("transcription unavailable");
      })
    };
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/getFile")) {
        return { ok: true, status: 200, json: async () => ({ ok: true, result: { file_path: "voice/file_504.ogg" } }) };
      }

      if (url.includes("/file/")) {
        return { ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode("voice bytes").buffer };
      }

      if (url.includes("/sendMessage")) {
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }

      throw new Error(`Unexpected URL ${url}`);
    });

    await expect(
      processTelegramUpdates(
        [
          {
            update_id: 54,
            message: {
              message_id: 504,
              date: 1779299180,
              chat: { id: 12345 },
              voice: { file_id: "voice-file", mime_type: "audio/ogg" }
            }
          }
        ],
        {
          allowedChatIds: new Set(["12345"]),
          botToken: "telegram-token",
          workspaceId: "workspace-demo",
          parser,
          prisma: client,
          audioTranscriber,
          fetchImpl: fetchMock as unknown as typeof fetch
        }
      )
    ).resolves.toEqual({ processed: 0, ignored: 1, lastUpdateId: 54 });

    expect(parser.parseLead).not.toHaveBeenCalled();
    expect(client.lead.create).not.toHaveBeenCalled();
    const sendCall = fetchMock.mock.calls.at(-1) as unknown as [string, { body?: unknown }];
    expect(JSON.parse(String(sendCall[1]?.body)).text).toContain("I received the audio, but I could not transcribe it");
  });

  it("starts an empty lead draft from the new lead command", async () => {
    const client = {
      lead: {
        findMany: vi.fn(),
        create: vi.fn()
      }
    };
    const parser: OpenAiLeadParserClient = {
      parseLead: vi.fn()
    };
    const telegramDraftStore = createMemoryTelegramLeadDraftSessionStore();
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/sendMessage")) {
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }

      throw new Error(`Unexpected URL ${url}`);
    });

    await expect(
      processTelegramUpdates(
        [
          {
            update_id: 12,
            message: {
              message_id: 7,
              date: 1779296500,
              chat: { id: 12345 },
              text: "/newlead"
            }
          }
        ],
        {
          allowedChatIds: new Set(["12345"]),
          botToken: "telegram-token",
          workspaceId: "workspace-demo",
          parser,
          prisma: client,
          telegramDraftStore,
          fetchImpl: fetchMock as unknown as typeof fetch
        }
      )
    ).resolves.toEqual({ processed: 0, ignored: 1, lastUpdateId: 12 });

    await expect(telegramDraftStore.getActive({ workspaceId: "workspace-demo", chatId: "12345" })).resolves.toMatchObject({
      draft: {
        missingData: ["clientName", "requestType", "projectAddress"]
      }
    });
    expect(client.lead.create).not.toHaveBeenCalled();
    const sendCall = fetchMock.mock.calls[0] as unknown as [string, { body?: unknown }];
    expect(JSON.parse(String(sendCall[1]?.body)).text).toContain("New lead draft started");
  });

  it("stores an incomplete document intake as a draft instead of creating a CRM lead", async () => {
    const client = {
      lead: {
        findMany: vi.fn(async () => [{ leadId: "L-2026-001", rawInput: "old" }]),
        create: vi.fn()
      }
    };
    const parser: OpenAiLeadParserClient = {
      parseLead: vi.fn(async () => ({
        clientName: "Katya",
        requestType: "new_build",
        urgency: "medium" as const,
        temperature: "warm" as const,
        projectAddress: undefined,
        email: null,
        phone: null,
        missingData: ["projectAddress", "bgfM2"],
        summary: "PDF lead draft",
        suggestedReply: "Need address and BGF."
      }))
    };
    const telegramDraftStore = createMemoryTelegramLeadDraftSessionStore();
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/getFile")) {
        return { ok: true, status: 200, json: async () => ({ ok: true, result: { file_path: "lead.pdf" } }) };
      }

      if (url.includes("/file/")) {
        return { ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode("pdf").buffer };
      }

      if (url.includes("/sendMessage")) {
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }

      throw new Error(`Unexpected URL ${url}`);
    });

    await expect(
      processTelegramUpdates(
        [
          {
            update_id: 13,
            message: {
              message_id: 8,
              date: 1779296560,
              chat: { id: 12345 },
              document: { file_id: "pdf-file", file_name: "lead.pdf", mime_type: "application/pdf" }
            }
          }
        ],
        {
          allowedChatIds: new Set(["12345"]),
          botToken: "telegram-token",
          workspaceId: "workspace-demo",
          parser,
          prisma: client,
          telegramDraftStore,
          fetchImpl: fetchMock as unknown as typeof fetch
        }
      )
    ).resolves.toEqual({ processed: 0, ignored: 1, lastUpdateId: 13 });

    await expect(telegramDraftStore.getActive({ workspaceId: "workspace-demo", chatId: "12345" })).resolves.toMatchObject({
      draft: {
        clientName: "Katya",
        requestType: "new_build",
        missingData: ["projectAddress", "bgfM2"]
      }
    });
    expect(client.lead.create).not.toHaveBeenCalled();
    const sendCall = fetchMock.mock.calls.at(-1) as unknown as [string, { body?: unknown }];
    const sendBody = JSON.parse(String(sendCall[1]?.body));
    expect(sendBody.text).toContain("Lead draft");
    expect(sendBody.text).toContain("Missing for KP: projectAddress, bgfM2");
  });

  it("creates a lead when current template required fields are ready even if static KP fields are missing", async () => {
    const created: unknown[] = [];
    const generated: unknown[] = [];
    const client = {
      lead: {
        findMany: vi.fn(async () => []),
        create: vi.fn(async (args: unknown) => {
          created.push(args);
          return { id: "lead-record-template-fields", leadId: "L-2026-010", status: "new" };
        }),
        update: vi.fn()
      }
    };
    const parser: OpenAiLeadParserClient = {
      parseLead: vi.fn(async () => ({
        clientName: "Oleg Project",
        requestType: "",
        urgency: "medium" as const,
        temperature: "warm" as const,
        bgfM2: undefined,
        projectAddress: "Ленина 12",
        email: null,
        phone: null,
        missingData: ["requestType", "bgfM2"],
        summary: "Template fields are available.",
        suggestedReply: "Created."
      }))
    };
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/sendMessage")) {
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }
      if (url.includes("/sendDocument")) {
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }

      throw new Error(`Unexpected URL ${url}`);
    });

    await expect(
      processTelegramUpdates(
        [
          {
            update_id: 24,
            message: {
              message_id: 42,
              date: 1779297000,
              chat: { id: 22345 },
              text: "Client Oleg Project, project address Ленина 12"
            }
          }
        ],
        {
          allowedChatIds: new Set(["22345"]),
          botToken: "telegram-token",
          workspaceId: "workspace-demo",
          parser,
          prisma: client,
          kpRequiredFields: ["clientName", "projectAddress"],
          generateKpDocument: async (input) => {
            generated.push(input);
            return {
              ...input,
              id: "generated-template-fields",
              docxAttachmentId: "docx-template-fields",
              pdfAttachmentId: "pdf-template-fields"
            };
          },
          fetchImpl: fetchMock as unknown as typeof fetch
        }
      )
    ).resolves.toEqual({ processed: 1, ignored: 0, lastUpdateId: 24 });

    expect(created).toHaveLength(1);
    expect(generated).toHaveLength(1);
    expect(created[0]).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          missingData: [],
          status: "new",
          projectAddress: "Ленина 12"
        })
      })
    );
  });

  it("enriches an active draft and creates a CRM lead when KP fields become complete", async () => {
    const created: unknown[] = [];
    const client = {
      lead: {
        findMany: vi.fn(async () => [{ leadId: "L-2026-001", rawInput: "old" }]),
        create: vi.fn(async (args: unknown) => {
          created.push(args);
          return { id: "lead-record-2", leadId: "L-2026-002", status: "new" };
        })
      }
    };
    const parser: OpenAiLeadParserClient = {
      parseLead: vi
        .fn()
        .mockResolvedValueOnce({
          clientName: "Katya",
          requestType: "new_build",
          urgency: "medium",
          temperature: "warm",
          projectAddress: null,
          email: null,
          phone: null,
          missingData: ["projectAddress", "bgfM2"],
          summary: "Initial lead",
          suggestedReply: "Need address and BGF."
        })
        .mockResolvedValueOnce({
          clientName: "",
          requestType: "",
          urgency: "medium",
          temperature: "unknown",
          projectAddress: "Chiemseeufer 7",
          bgfM2: 180,
          email: null,
          phone: null,
          missingData: [],
          summary: "Follow-up fields",
          suggestedReply: "Ready."
        })
    };
    const telegramDraftStore = createMemoryTelegramLeadDraftSessionStore();
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/sendMessage")) {
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }

      throw new Error(`Unexpected URL ${url}`);
    });
    const config = {
      allowedChatIds: new Set(["12345"]),
      botToken: "telegram-token",
      workspaceId: "workspace-demo",
      crmBaseUrl: "https://crm.example.com",
      parser,
      prisma: client,
      telegramDraftStore,
      fetchImpl: fetchMock as unknown as typeof fetch
    };

    await processTelegramUpdates(
      [
        {
          update_id: 14,
          message: {
            message_id: 9,
            date: 1779296600,
            chat: { id: 12345 },
            text: "Katya needs new build offer"
          }
        }
      ],
      config
    );

    await expect(
      processTelegramUpdates(
        [
          {
            update_id: 15,
            message: {
              message_id: 10,
              date: 1779296660,
              chat: { id: 12345 },
              text: "Address Chiemseeufer 7, BGF 180"
            }
          }
        ],
        config
      )
    ).resolves.toEqual({ processed: 1, ignored: 0, lastUpdateId: 15 });

    expect(created).toEqual([
      {
        data: expect.objectContaining({
          leadId: "L-2026-002",
          status: "new",
          requestType: "new_build",
          projectAddress: "Chiemseeufer 7",
          bgfM2: 180,
          missingData: []
        })
      }
    ]);
    await expect(telegramDraftStore.getActive({ workspaceId: "workspace-demo", chatId: "12345" })).resolves.toBeNull();
    const sendCall = fetchMock.mock.calls.at(-1) as unknown as [string, { body?: unknown }];
    const sendBody = JSON.parse(String(sendCall[1]?.body));
    expect(sendBody.text).toContain("KP fields ready");
    expect(sendBody.reply_markup.inline_keyboard[0][0].url).toBe("https://crm.example.com/leads?leadId=L-2026-002");
  });

  it("generates and links a KP document when Telegram lead fields are ready", async () => {
    const created: unknown[] = [];
    const updates: unknown[] = [];
    const generatedDocuments: unknown[] = [];
    const client = {
      lead: {
        findMany: vi.fn(async () => [{ leadId: "L-2026-001", rawInput: "old" }]),
        create: vi.fn(async (args: unknown) => {
          created.push(args);
          return { id: "lead-record-2", leadId: "L-2026-002", status: "new" };
        }),
        update: vi.fn(async (args: unknown) => {
          updates.push(args);
          return { id: "lead-record-2", leadId: "L-2026-002", status: "new" };
        })
      }
    };
    const parser: OpenAiLeadParserClient = {
      parseLead: vi.fn(async () => ({
        clientName: "Katya",
        requestType: "new_build",
        urgency: "high" as const,
        temperature: "hot" as const,
        projectAddress: "Chiemseeufer 7",
        bgfM2: 180,
        email: "katya@example.com",
        phone: null,
        missingData: [],
        summary: "Ready KP lead",
        suggestedReply: "Ready."
      }))
    };
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/sendMessage")) {
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }

      if (url.includes("/sendDocument")) {
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }

      throw new Error(`Unexpected URL ${url}`);
    });

    await expect(
      processTelegramUpdates(
        [
          {
            update_id: 18,
            message: {
              message_id: 13,
              date: 1779296800,
              chat: { id: 12345 },
              text: "Katya, new build, Chiemseeufer 7, BGF 180"
            }
          }
        ],
        {
          allowedChatIds: new Set(["12345"]),
          botToken: "telegram-token",
          workspaceId: "workspace-demo",
          crmBaseUrl: "https://crm.example.com",
          parser,
          prisma: client,
          generateKpDocument: async (input) => {
            generatedDocuments.push(input);
            return {
              id: "generated-document-record-1",
              ...input,
              docxAttachmentId: "attachment-docx-1",
              pdfAttachmentId: "attachment-pdf-1",
              docxDeliveryUrl: "https://files.example.com/kp.docx"
            };
          },
          fetchImpl: fetchMock as unknown as typeof fetch
        }
      )
    ).resolves.toEqual({ processed: 1, ignored: 0, lastUpdateId: 18 });

    expect(generatedDocuments).toEqual([
      expect.objectContaining({
        workspaceId: "workspace-demo",
        documentId: "D-telegram-12345-13",
        documentType: "kp",
        sourceRecordIds: ["L-2026-002"],
        fieldSnapshot: expect.objectContaining({
          clientName: "Katya",
          requestType: "new_build",
          projectAddress: "Chiemseeufer 7",
          bgfM2: 180,
          email: "katya@example.com",
          missingData: []
        }),
        requestedByUserId: "telegram:12345"
      })
    ]);
    expect(updates).toEqual([
      {
        where: { id: "lead-record-2" },
        data: { kpGeneratedDocumentId: "D-telegram-12345-13" }
      }
    ]);
    const documentCall = fetchMock.mock.calls.find(([url]) => String(url).includes("/sendDocument")) as unknown as [
      string,
      { body?: unknown }
    ];
    expect(JSON.parse(String(documentCall[1].body))).toMatchObject({
      chat_id: "12345",
      document: "https://crm.example.com/documents/attachments/attachment-pdf-1",
      caption: "KP document D-telegram-12345-13 is ready."
    });
    const finalMessageCall = fetchMock.mock.calls.at(-1) as unknown as [string, { body?: unknown }];
    const finalMessageBody = JSON.parse(String(finalMessageCall[1].body));
    expect(finalMessageBody.parse_mode).toBe("HTML");
    expect(finalMessageBody.text).toContain("<b>Standard pricing branch</b>");
    expect(finalMessageBody.text).toContain("<b>Pricing branch</b>: standard");
    expect(finalMessageBody.text).toContain("<b>KP document</b>: D-telegram-12345-13");
    expect(finalMessageBody.reply_markup.inline_keyboard[0]).toEqual([
      { text: "CRM", url: "https://crm.example.com/leads?leadId=L-2026-002" },
      { text: "PDF", url: "https://crm.example.com/documents/attachments/attachment-pdf-1" },
      { text: "DOC", url: "https://files.example.com/kp.docx" },
      { text: "Send KP", url: "mailto:katya@example.com?subject=KP%20L-2026-002" },
      { text: "Mark KP sent", callback_data: "lead_action:mark_kp_sent:L-2026-002" }
    ]);
    expect(finalMessageBody.reply_markup.inline_keyboard[0].map((button: { url?: string }) => button.url).filter(Boolean)).toSatisfy((urls: string[]) =>
      urls.every((url) => /^(?:https?:\/\/|mailto:)/.test(url))
    );
  });

  it("marks and undoes KP sent from Telegram inline action callbacks", async () => {
    const updates: unknown[] = [];
    const client = {
      lead: {
        findMany: vi.fn(async (args: unknown) => {
          const where = (args as { where?: { workspaceId?: string; leadId?: string } }).where;
          if (where?.workspaceId === "workspace-demo" && where.leadId === "L-2026-002") {
            return [
              {
                id: "lead-record-2",
                leadId: "L-2026-002",
                status: "new",
                rawInput: "Telegram lead card: telegram-bot:12345:900",
                missingData: []
              }
            ];
          }

          return [];
        }),
        create: vi.fn(),
        update: vi.fn(async (args: unknown) => {
          updates.push(args);
          return { id: "lead-record-2", leadId: "L-2026-002", status: "kp_sent" };
        })
      }
    };
    const parser: OpenAiLeadParserClient = { parseLead: vi.fn() };
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/answerCallbackQuery") || url.includes("/sendMessage")) {
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }

      throw new Error(`Unexpected URL ${url}`);
    });
    const config = {
      allowedChatIds: new Set(["12345"]),
      botToken: "telegram-token",
      workspaceId: "workspace-demo",
      parser,
      prisma: client,
      fetchImpl: fetchMock as unknown as typeof fetch
    };

    await processTelegramUpdates(
      [
        {
          update_id: 30,
          callback_query: {
            id: "callback-mark",
            message: { message_id: 900, date: 1779297060, chat: { id: 12345 } },
            data: "lead_action:mark_kp_sent:L-2026-002"
          }
        }
      ],
      config
    );
    await processTelegramUpdates(
      [
        {
          update_id: 31,
          callback_query: {
            id: "callback-undo",
            message: { message_id: 900, date: 1779297120, chat: { id: 12345 } },
            data: "lead_action:undo_kp_sent:L-2026-002"
          }
        }
      ],
      config
    );

    expect(parser.parseLead).not.toHaveBeenCalled();
    expect(updates[0]).toEqual({
      where: { id: "lead-record-2" },
      data: expect.objectContaining({
        status: "kp_sent",
        kpSentDate: new Date("2026-05-20T17:11:00.000Z"),
        followupStatus: "planned"
      })
    });
    expect(updates[1]).toEqual({
      where: { id: "lead-record-2" },
      data: {
        kpSentDate: null,
        followup1Date: null,
        followupStatus: null,
        status: "new"
      }
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.telegram.org/bottelegram-token/answerCallbackQuery",
      expect.objectContaining({ method: "POST", body: expect.stringContaining("callback-mark") })
    );
  });

  it("persists Telegram channel events when a KP-ready lead is created", async () => {
    const auditEvents: unknown[] = [];
    const client = {
      lead: {
        findMany: vi.fn(async () => [{ leadId: "L-2026-001", rawInput: "old" }]),
        create: vi.fn(async () => ({ id: "lead-record-2", leadId: "L-2026-002", status: "new" })),
        update: vi.fn(async () => ({ id: "lead-record-2", leadId: "L-2026-002", status: "new" }))
      }
    };
    const parser: OpenAiLeadParserClient = {
      parseLead: vi.fn(async () => ({
        clientName: "Katya",
        requestType: "new_build",
        urgency: "high" as const,
        temperature: "hot" as const,
        projectAddress: "Chiemseeufer 7",
        bgfM2: 180,
        email: "katya@example.com",
        phone: null,
        missingData: [],
        summary: "Ready KP lead",
        suggestedReply: "Ready."
      }))
    };
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/sendMessage") || url.includes("/sendDocument")) {
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }

      throw new Error(`Unexpected URL ${url}`);
    });

    await processTelegramUpdates(
      [
        {
          update_id: 118,
          message: {
            message_id: 113,
            date: 1779296800,
            chat: { id: 12345 },
            text: "Katya, new build, Chiemseeufer 7, BGF 180"
          }
        }
      ],
      {
        allowedChatIds: new Set(["12345"]),
        botToken: "telegram-token",
        workspaceId: "workspace-demo",
        crmBaseUrl: "https://crm.example.com",
        parser,
        prisma: client,
        generateKpDocument: async (input) => ({
          id: "generated-document-record-1",
          ...input,
          docxAttachmentId: "attachment-docx-1",
          pdfAttachmentId: "attachment-pdf-1"
        }),
        saveAuditEvent: async (event) => {
          auditEvents.push(event);
        },
        fetchImpl: fetchMock as unknown as typeof fetch
      }
    );

    expect(auditEvents.map((event) => (event as { metadata: { type: string } }).metadata.type)).toEqual([
      "message_received",
      "lead_created",
      "kp_generated"
    ]);
    expect(auditEvents).toContainEqual(
      expect.objectContaining({
        workspaceId: "workspace-demo",
        actorUserId: "telegram:12345",
        action: "assistant.channel.event",
        targetType: "AssistantChannelEvent",
        targetId: "telegram:lead_created:telegram:12345:L-2026-002",
        metadata: expect.objectContaining({
          type: "lead_created",
          channel: "telegram",
          threadId: "telegram:12345",
          leadId: "L-2026-002",
          fieldsCreated: expect.arrayContaining(["clientName", "requestType", "projectAddress", "bgfM2", "email"]),
          missingData: []
        })
      })
    );
  });

  it("sends a CRM attachment URL when only an internal attachment id exists", async () => {
    const client = {
      lead: {
        findMany: vi.fn(async () => [{ leadId: "L-2026-001", rawInput: "old" }]),
        create: vi.fn(async () => ({ id: "lead-record-2", leadId: "L-2026-002", status: "new" })),
        update: vi.fn(async () => ({ id: "lead-record-2", leadId: "L-2026-002", status: "new" }))
      }
    };
    const parser: OpenAiLeadParserClient = {
      parseLead: vi.fn(async () => ({
        clientName: "Katya",
        requestType: "new_build",
        urgency: "high" as const,
        temperature: "hot" as const,
        projectAddress: "Chiemseeufer 7",
        bgfM2: 180,
        email: null,
        phone: null,
        missingData: [],
        summary: "Ready KP lead",
        suggestedReply: "Ready."
      }))
    };
    const fetchMock = vi.fn(async (url: string, init?: { body?: unknown }) => {
      if (url.includes("/sendMessage")) {
        const body = JSON.parse(String(init?.body));
        const urls = body.reply_markup?.inline_keyboard?.flat().map((button: { url?: string }) => button.url).filter(Boolean) ?? [];
        if (!urls.every((buttonUrl: string) => /^https?:\/\//.test(buttonUrl))) {
          return { ok: false, status: 400, statusText: "Bad Request" };
        }

        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }

      if (url.includes("/sendDocument")) {
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }

      throw new Error(`Unexpected URL ${url}`);
    });

    await processTelegramUpdates(
      [
        {
          update_id: 19,
          message: {
            message_id: 14,
            date: 1779296860,
            chat: { id: 12345 },
            text: "Katya, new build, Chiemseeufer 7, BGF 180"
          }
        }
      ],
      {
        allowedChatIds: new Set(["12345"]),
        botToken: "telegram-token",
        workspaceId: "workspace-demo",
        crmBaseUrl: "https://crm.example.com",
        parser,
        prisma: client,
        generateKpDocument: async (input) => ({
          id: "generated-document-record-1",
          ...input,
          docxAttachmentId: "attachment-docx-1"
        }),
        fetchImpl: fetchMock as unknown as typeof fetch
      }
    );

    const documentCall = fetchMock.mock.calls.find(([url]) => String(url).includes("/sendDocument")) as unknown as [
      string,
      { body?: unknown }
    ];
    expect(JSON.parse(String(documentCall[1].body))).toMatchObject({
      chat_id: "12345",
      document: "https://crm.example.com/documents/attachments/attachment-docx-1?download=1"
    });
    const finalMessageCall = fetchMock.mock.calls.at(-1) as unknown as [string, { body?: unknown }];
    expect(JSON.parse(String(finalMessageCall[1].body)).text).toContain("<b>KP document</b>: D-telegram-12345-14");
    expect(JSON.parse(String(finalMessageCall[1].body)).text).toContain("<b>KP file</b>: sent to Telegram");
  });

  it("still confirms the lead when Telegram document delivery fails", async () => {
    const client = {
      lead: {
        findMany: vi.fn(async () => [{ leadId: "L-2026-001", rawInput: "old" }]),
        create: vi.fn(async () => ({ id: "lead-record-2", leadId: "L-2026-002", status: "new" })),
        update: vi.fn(async () => ({ id: "lead-record-2", leadId: "L-2026-002", status: "new" }))
      }
    };
    const parser: OpenAiLeadParserClient = {
      parseLead: vi.fn(async () => ({
        clientName: "Katya",
        requestType: "new_build",
        urgency: "high" as const,
        temperature: "hot" as const,
        projectAddress: "Chiemseeufer 7",
        bgfM2: 180,
        email: null,
        phone: null,
        missingData: [],
        summary: "Ready KP lead",
        suggestedReply: "Ready."
      }))
    };
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/sendMessage")) {
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }

      if (url.includes("/sendDocument")) {
        return { ok: false, status: 400, statusText: "Bad Request" };
      }

      throw new Error(`Unexpected URL ${url}`);
    });

    await expect(
      processTelegramUpdates(
        [
          {
            update_id: 20,
            message: {
              message_id: 15,
              date: 1779296920,
              chat: { id: 12345 },
              text: "Katya, new build, Chiemseeufer 7, BGF 180"
            }
          }
        ],
        {
          allowedChatIds: new Set(["12345"]),
          botToken: "telegram-token",
          workspaceId: "workspace-demo",
          crmBaseUrl: "https://crm.example.com",
          parser,
          prisma: client,
          generateKpDocument: async (input) => ({
            id: "generated-document-record-1",
            ...input,
            pdfAttachmentId: "attachment-pdf-1"
          }),
          fetchImpl: fetchMock as unknown as typeof fetch
        }
      )
    ).resolves.toEqual({ processed: 1, ignored: 0, lastUpdateId: 20 });

    const finalMessageCall = fetchMock.mock.calls.at(-1) as unknown as [string, { body?: unknown }];
    const finalMessageBody = JSON.parse(String(finalMessageCall[1].body));
    expect(finalMessageBody.text).toContain("<b>KP document</b>: D-telegram-12345-15");
    expect(finalMessageBody.text).toContain("<b>KP file</b>: saved in CRM");
  });

  it("confirms the lead with a clear KP error when template generation fails", async () => {
    const client = {
      lead: {
        findMany: vi.fn(async () => [{ leadId: "L-2026-001", rawInput: "old" }]),
        create: vi.fn(async () => ({ id: "lead-record-2", leadId: "L-2026-002", status: "new" })),
        update: vi.fn()
      }
    };
    const parser: OpenAiLeadParserClient = {
      parseLead: vi.fn(async () => ({
        clientName: "Katya",
        requestType: "new_build",
        urgency: "high" as const,
        temperature: "hot" as const,
        projectAddress: "Chiemseeufer 7",
        bgfM2: 180,
        email: null,
        phone: null,
        missingData: [],
        summary: "Ready KP lead",
        suggestedReply: "Ready."
      }))
    };
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/sendMessage")) {
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }

      throw new Error(`Unexpected URL ${url}`);
    });

    await expect(
      processTelegramUpdates(
        [
          {
            update_id: 24,
            message: {
              message_id: 16,
              date: 1779297200,
              chat: { id: 12345 },
              text: "Katya, new build, Chiemseeufer 7, BGF 180"
            }
          }
        ],
        {
          allowedChatIds: new Set(["12345"]),
          botToken: "telegram-token",
          workspaceId: "workspace-demo",
          crmBaseUrl: "https://crm.example.com",
          parser,
          prisma: client,
          generateKpDocument: async () => {
            throw new Error("No current KP template is uploaded in Settings > Templates.");
          },
          fetchImpl: fetchMock as unknown as typeof fetch
        }
      )
    ).resolves.toEqual({ processed: 1, ignored: 0, lastUpdateId: 24 });

    const finalMessageCall = fetchMock.mock.calls.at(-1) as unknown as [string, { body?: unknown }];
    const finalMessageBody = JSON.parse(String(finalMessageCall[1].body));
    expect(finalMessageBody.text).toContain("<b>Lead</b>: L-2026-002");
    expect(finalMessageBody.text).toContain("<b>KP generation</b>: lead created, but KP was not generated because the current KP template is missing");
  });

  it("does not report a missing template when PDF export is unavailable", async () => {
    const client = {
      lead: {
        findMany: vi.fn(async () => [{ leadId: "L-2026-001", rawInput: "old" }]),
        create: vi.fn(async () => ({ id: "lead-record-2", leadId: "L-2026-002", status: "new" })),
        update: vi.fn()
      }
    };
    const parser: OpenAiLeadParserClient = {
      parseLead: vi.fn(async () => ({
        clientName: "Katya",
        requestType: "new_build",
        urgency: "high" as const,
        temperature: "hot" as const,
        projectAddress: "Chiemseeufer 7",
        bgfM2: 180,
        email: null,
        phone: null,
        missingData: [],
        summary: "Ready KP lead",
        suggestedReply: "Ready."
      }))
    };
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/sendMessage")) {
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }

      throw new Error(`Unexpected URL ${url}`);
    });

    await expect(
      processTelegramUpdates(
        [
          {
            update_id: 25,
            message: {
              message_id: 17,
              date: 1779297200,
              chat: { id: 32345 },
              text: "Katya, new build, Chiemseeufer 7, BGF 180"
            }
          }
        ],
        {
          allowedChatIds: new Set(["32345"]),
          botToken: "telegram-token",
          workspaceId: "workspace-demo",
          crmBaseUrl: "https://crm.example.com",
          parser,
          prisma: client,
          generateKpDocument: async () => {
            throw new Error("DOCX was generated from the current KP template, but PDF export is not configured.");
          },
          fetchImpl: fetchMock as unknown as typeof fetch
        }
      )
    ).resolves.toEqual({ processed: 1, ignored: 0, lastUpdateId: 25 });

    const finalMessageCall = fetchMock.mock.calls.at(-1) as unknown as [string, { body?: unknown }];
    const finalMessageBody = JSON.parse(String(finalMessageCall[1].body));
    expect(finalMessageBody.text).toContain(
      "<b>KP generation</b>: lead created, but KP was not generated because PDF export is not configured or failed."
    );
  });

  it("treats a reply to the bot draft message as an explicit update to that draft", async () => {
    const created: unknown[] = [];
    const client = {
      lead: {
        findMany: vi.fn(async () => [{ leadId: "L-2026-001", rawInput: "old" }]),
        create: vi.fn(async (args: unknown) => {
          created.push(args);
          return { id: "lead-record-2", leadId: "L-2026-002", status: "new" };
        })
      }
    };
    const parser: OpenAiLeadParserClient = {
      parseLead: vi
        .fn()
        .mockResolvedValueOnce({
          clientName: "Katya",
          requestType: "new_build",
          urgency: "medium",
          temperature: "warm",
          projectAddress: "Chiemseeufer 7",
          email: null,
          phone: null,
          missingData: ["bgfM2"],
          summary: "Draft without BGF",
          suggestedReply: "Need BGF."
        })
        .mockResolvedValueOnce({
          clientName: "Max",
          requestType: "new_build",
          urgency: "medium",
          temperature: "unknown",
          projectAddress: "Munich",
          bgfM2: 180,
          email: null,
          phone: null,
          missingData: [],
          summary: "Reply with BGF",
          suggestedReply: "Ready."
        })
    };
    const telegramDraftStore = createMemoryTelegramLeadDraftSessionStore();
    let nextBotMessageId = 500;
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/sendMessage")) {
        return { ok: true, status: 200, json: async () => ({ ok: true, result: { message_id: nextBotMessageId++ } }) };
      }

      throw new Error(`Unexpected URL ${url}`);
    });
    const config = {
      allowedChatIds: new Set(["12345"]),
      botToken: "telegram-token",
      workspaceId: "workspace-demo",
      parser,
      prisma: client,
      telegramDraftStore,
      fetchImpl: fetchMock as unknown as typeof fetch
    };

    await processTelegramUpdates(
      [
        {
          update_id: 16,
          message: {
            message_id: 11,
            date: 1779296700,
            chat: { id: 12345 },
            text: "Katya new build at Chiemseeufer 7"
          }
        }
      ],
      config
    );

    await expect(
      processTelegramUpdates(
        [
          {
            update_id: 17,
            message: {
              message_id: 12,
              date: 1779296760,
              chat: { id: 12345 },
              reply_to_message: { message_id: 500 },
              text: "BGF 180"
            }
          }
        ],
        config
      )
    ).resolves.toEqual({ processed: 1, ignored: 0, lastUpdateId: 17 });

    expect(created).toEqual([
      {
        data: expect.objectContaining({
          leadId: "L-2026-002",
          projectAddress: "Chiemseeufer 7",
          bgfM2: 180
        })
      }
    ]);
  });

  it("updates an existing lead when replying to the bot lead card", async () => {
    const updates: unknown[] = [];
    const client = {
      lead: {
        findMany: vi.fn(async (args: unknown) => {
          const rawInput = (args as { where?: { rawInput?: { contains?: string } } }).where?.rawInput?.contains;
          if (rawInput === "telegram-bot:12345:900") {
            return [
              {
                id: "lead-record-2",
                leadId: "L-2026-002",
                status: "needs_data",
                rawInput: "Initial lead\nTelegram lead card: telegram-bot:12345:900",
                clientName: "Katya",
                requestType: "new_build",
                projectAddress: "Chiemseeufer 7",
                bgfM2: null,
                email: null,
                phone: null,
                missingData: ["bgfM2"]
              }
            ];
          }

          return [{ leadId: "L-2026-001", rawInput: "old" }];
        }),
        create: vi.fn(),
        update: vi.fn(async (args: unknown) => {
          updates.push(args);
          return { id: "lead-record-2", leadId: "L-2026-002", status: "new" };
        })
      }
    };
    const parser: OpenAiLeadParserClient = {
      parseLead: vi.fn(async () => ({
        clientName: "",
        requestType: "",
        urgency: "medium" as const,
        temperature: "unknown" as const,
        projectAddress: undefined,
        bgfM2: 180,
        email: "katya@example.com",
        phone: null,
        missingData: [],
        summary: "BGF and email update",
        suggestedReply: "Updated."
      }))
    };
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/sendMessage")) {
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }

      throw new Error(`Unexpected URL ${url}`);
    });

    await expect(
      processTelegramUpdates(
        [
          {
            update_id: 21,
            message: {
              message_id: 31,
              date: 1779297000,
              chat: { id: 12345 },
              reply_to_message: { message_id: 900 },
              text: "BGF 180, email katya@example.com"
            }
          }
        ],
        {
          allowedChatIds: new Set(["12345"]),
          botToken: "telegram-token",
          workspaceId: "workspace-demo",
          parser,
          prisma: client,
          fetchImpl: fetchMock as unknown as typeof fetch
        }
      )
    ).resolves.toEqual({ processed: 1, ignored: 0, lastUpdateId: 21 });

    expect(client.lead.create).not.toHaveBeenCalled();
    expect(updates).toEqual([
      {
        where: { id: "lead-record-2" },
        data: expect.objectContaining({
          bgfM2: 180,
          missingData: [],
          status: "new",
          rawInput: expect.stringContaining("telegram lead update")
        })
      }
    ]);
    const sendCall = fetchMock.mock.calls.at(-1) as unknown as [string, { body?: unknown }];
    const sendBody = JSON.parse(String(sendCall[1].body));
    expect(sendBody.parse_mode).toBe("HTML");
    expect(sendBody.text).toContain("Updated lead <b>L-2026-002</b>");
  });

  it("answers support questions on a replied lead card without parsing them as lead updates", async () => {
    const client = {
      lead: {
        findMany: vi.fn(async (args: unknown) => {
          const rawInput = (args as { where?: { rawInput?: { contains?: string } } }).where?.rawInput?.contains;
          if (rawInput === "telegram-bot:12345:900") {
            return [
              {
                id: "lead-record-2",
                leadId: "L-2026-002",
                status: "needs_data",
                rawInput: "Telegram lead card: telegram-bot:12345:900",
                missingData: ["bgfM2"]
              }
            ];
          }

          return [];
        }),
        create: vi.fn(),
        update: vi.fn()
      }
    };
    const parser: OpenAiLeadParserClient = { parseLead: vi.fn() };
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/sendMessage")) {
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }

      throw new Error(`Unexpected URL ${url}`);
    });

    await expect(
      processTelegramUpdates(
        [
          {
            update_id: 22,
            message: {
              message_id: 32,
              date: 1779297060,
              chat: { id: 12345 },
              reply_to_message: { message_id: 900 },
              text: "What is the status?"
            }
          }
        ],
        {
          allowedChatIds: new Set(["12345"]),
          botToken: "telegram-token",
          workspaceId: "workspace-demo",
          parser,
          prisma: client,
          fetchImpl: fetchMock as unknown as typeof fetch
        }
      )
    ).resolves.toEqual({ processed: 0, ignored: 1, lastUpdateId: 22 });

    expect(parser.parseLead).not.toHaveBeenCalled();
    expect(client.lead.update).not.toHaveBeenCalled();
    const sendCall = fetchMock.mock.calls.at(-1) as unknown as [string, { body?: unknown }];
    const sendBody = JSON.parse(String(sendCall[1].body));
    expect(sendBody.text).toContain("L-2026-002");
  });

  it("marks and undoes KP sent from replies to the bot lead card", async () => {
    const updates: unknown[] = [];
    const client = {
      lead: {
        findMany: vi.fn(async (args: unknown) => {
          const rawInput = (args as { where?: { rawInput?: { contains?: string } } }).where?.rawInput?.contains;
          if (rawInput === "telegram-bot:12345:900") {
            return [
              {
                id: "lead-record-2",
                leadId: "L-2026-002",
                status: "new",
                rawInput: "Telegram lead card: telegram-bot:12345:900",
                missingData: []
              }
            ];
          }

          return [];
        }),
        create: vi.fn(),
        update: vi.fn(async (args: unknown) => {
          updates.push(args);
          return { id: "lead-record-2", leadId: "L-2026-002", status: "kp_sent" };
        })
      }
    };
    const parser: OpenAiLeadParserClient = { parseLead: vi.fn() };
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/sendMessage")) {
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }

      throw new Error(`Unexpected URL ${url}`);
    });
    const config = {
      allowedChatIds: new Set(["12345"]),
      botToken: "telegram-token",
      workspaceId: "workspace-demo",
      parser,
      prisma: client,
      fetchImpl: fetchMock as unknown as typeof fetch
    };

    await processTelegramUpdates(
      [
        {
          update_id: 22,
          message: {
            message_id: 32,
            date: 1779297060,
            chat: { id: 12345 },
            reply_to_message: { message_id: 900 },
            text: "KP sent"
          }
        }
      ],
      config
    );
    await processTelegramUpdates(
      [
        {
          update_id: 23,
          message: {
            message_id: 33,
            date: 1779297120,
            chat: { id: 12345 },
            reply_to_message: { message_id: 900 },
            text: "undo KP sent"
          }
        }
      ],
      config
    );

    expect(parser.parseLead).not.toHaveBeenCalled();
    expect(updates[0]).toEqual({
      where: { id: "lead-record-2" },
      data: expect.objectContaining({
        status: "kp_sent",
        kpSentDate: new Date("2026-05-20T17:11:00.000Z"),
        followupStatus: "planned"
      })
    });
    expect(updates[1]).toEqual({
      where: { id: "lead-record-2" },
      data: {
        kpSentDate: null,
        followup1Date: null,
        followupStatus: null,
        status: "new"
      }
    });
  });

  it("answers capability questions without creating a lead", async () => {
    const client = {
      lead: {
        findMany: vi.fn(),
        create: vi.fn()
      }
    };
    const parser: OpenAiLeadParserClient = {
      parseLead: vi.fn()
    };
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/sendMessage")) {
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }

      throw new Error(`Unexpected URL ${url}`);
    });

    await expect(
      processTelegramUpdates(
        [
          {
            update_id: 10,
            message: {
              message_id: 5,
              date: 1779296400,
              chat: { id: 12345 },
              text: "Что ты умеешь?"
            }
          }
        ],
        {
          allowedChatIds: new Set(["12345"]),
          botToken: "telegram-token",
          workspaceId: "workspace-demo",
          parser,
          prisma: client,
          fetchImpl: fetchMock as unknown as typeof fetch
        }
      )
    ).resolves.toEqual({ processed: 0, ignored: 1, lastUpdateId: 10 });

    expect(parser.parseLead).not.toHaveBeenCalled();
    expect(client.lead.create).not.toHaveBeenCalled();
    const sendCall = fetchMock.mock.calls[0] as unknown as [string, { body?: unknown }];
    const body = JSON.parse(String(sendCall[1]?.body));
    expect(body.text).toContain("I can create and update leads");
    expect(body.text).toContain("voice messages");
  });

  it("answers /help with the shared assistant capability text", async () => {
    const client = {
      lead: {
        findMany: vi.fn(),
        create: vi.fn()
      }
    };
    const parser: OpenAiLeadParserClient = {
      parseLead: vi.fn()
    };
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/sendMessage")) {
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }

      throw new Error(`Unexpected URL ${url}`);
    });

    await expect(
      processTelegramUpdates(
        [
          {
            update_id: 11,
            message: {
              message_id: 6,
              date: 1779296460,
              chat: { id: 12345 },
              text: "/help"
            }
          }
        ],
        {
          allowedChatIds: new Set(["12345"]),
          botToken: "telegram-token",
          workspaceId: "workspace-demo",
          parser,
          prisma: client,
          fetchImpl: fetchMock as unknown as typeof fetch
        }
      )
    ).resolves.toEqual({ processed: 0, ignored: 1, lastUpdateId: 11 });

    expect(parser.parseLead).not.toHaveBeenCalled();
    expect(client.lead.create).not.toHaveBeenCalled();
    const sendCall = fetchMock.mock.calls[0] as unknown as [string, { body?: unknown }];
    const body = JSON.parse(String(sendCall[1]?.body));
    expect(body.text).toContain("I can create and update leads");
  });

  it("sends a friendly onboarding message on start", async () => {
    const client = {
      lead: {
        findMany: vi.fn(),
        create: vi.fn()
      }
    };
    const parser: OpenAiLeadParserClient = {
      parseLead: vi.fn()
    };
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/sendMessage")) {
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }

      throw new Error(`Unexpected URL ${url}`);
    });

    await expect(
      processTelegramUpdates(
        [
          {
            update_id: 24,
            message: {
              message_id: 34,
              date: 1779297180,
              chat: { id: 12345 },
              text: "/start"
            }
          }
        ],
        {
          allowedChatIds: new Set(["12345"]),
          botToken: "telegram-token",
          workspaceId: "workspace-demo",
          parser,
          prisma: client,
          fetchImpl: fetchMock as unknown as typeof fetch
        }
      )
    ).resolves.toEqual({ processed: 0, ignored: 1, lastUpdateId: 24 });

    expect(parser.parseLead).not.toHaveBeenCalled();
    expect(client.lead.create).not.toHaveBeenCalled();
    const sendCall = fetchMock.mock.calls[0] as unknown as [string, { body?: unknown }];
    const body = JSON.parse(String(sendCall[1]?.body));
    expect(body.text).toContain("I can create and update leads");
  });

  it("skips duplicate Telegram source messages before parsing", async () => {
    const client = {
      lead: {
        findMany: vi.fn(async () => [{ leadId: "L-2026-001", rawInput: "Telegram sources: telegram:12345:5" }]),
        create: vi.fn()
      }
    };
    const parser: OpenAiLeadParserClient = {
      parseLead: vi.fn()
    };

    await expect(
      processTelegramUpdates(
        [
          {
            update_id: 10,
            message: {
              message_id: 5,
              date: 1779296400,
              chat: { id: 12345 },
              text: "Already processed"
            }
          }
        ],
        {
          allowedChatIds: new Set(["12345"]),
          botToken: "telegram-token",
          workspaceId: "workspace-demo",
          parser,
          prisma: client,
          fetchImpl: vi.fn() as unknown as typeof fetch
        }
      )
    ).resolves.toEqual({ processed: 0, ignored: 1, lastUpdateId: 10 });

    expect(parser.parseLead).not.toHaveBeenCalled();
    expect(client.lead.create).not.toHaveBeenCalled();
  });

  it("runs worker iterations in loop mode with injectable sleep", async () => {
    const runs: number[] = [];
    const sleeps: number[] = [];

    await expect(
      runTelegramWorkerLoop({
        intervalMs: 250,
        maxIterations: 3,
        runOnce: async (iteration) => {
          runs.push(iteration);
          return { processed: iteration, ignored: 0 };
        },
        sleep: async (intervalMs) => {
          sleeps.push(intervalMs);
        },
        onResult: () => undefined
      })
    ).resolves.toEqual({ iterations: 3, processed: 6, ignored: 0 });

    expect(runs).toEqual([1, 2, 3]);
    expect(sleeps).toEqual([250, 250]);
  });
});
