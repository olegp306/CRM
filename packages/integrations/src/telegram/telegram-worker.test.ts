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
          rawInput: expect.stringContaining("Telegram source: telegram:12345:5")
        })
      }
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.telegram.org/bottelegram-token/sendMessage",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("Lead draft L-2026-002 created")
      })
    );
  });

  it("skips duplicate Telegram source messages before parsing", async () => {
    const client = {
      lead: {
        findMany: vi.fn(async () => [{ leadId: "L-2026-001", rawInput: "Telegram source: telegram:12345:5" }]),
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
