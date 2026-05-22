import { describe, expect, it, vi } from "vitest";
import type { OpenAiLeadParserClient } from "./openai-lead-parser";
import { createTelegramTestUpdateFromEnv, processTelegramUpdates, runTelegramWorkerLoop } from "./telegram-worker";

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
        body: expect.stringContaining("Готово, я создал лид в CRM.")
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
    expect(sendBody.text).toContain("Missing data: budget");
    expect(sendBody.reply_markup.inline_keyboard[0][0]).toEqual({
      text: "Open in CRM",
      url: "https://crm.example.com/leads?leadId=L-2026-002"
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
    expect(String(sendCall[1]?.body)).toContain("Я умею принимать заявки");
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
