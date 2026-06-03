import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OpenAiLeadParserClient } from "./openai-lead-parser";
import {
  createTelegramTestUpdateFromEnv,
  processTelegramUpdates,
  resetTelegramWorkerMemoryForTests,
  resolveTelegramAiSettings,
  runTelegramWorkerLoop,
  runTelegramWorkerOnce
} from "./telegram-worker";
import { createMemoryTelegramLeadDraftSessionStore } from "./telegram-lead-draft-session";

describe("telegram worker", () => {
  beforeEach(() => {
    resetTelegramWorkerMemoryForTests();
  });

  it("loads client material, CRM orchestrator, and CRM entity extractor AI settings for Telegram runtime", async () => {
    const store = {
      getClientMaterialAnalysis: vi.fn(async () => ({
        workspaceId: "workspace-demo",
        role: "client_material_analysis" as const,
        model: "gpt-4.1",
        prompt: "Analyze source materials.",
        updatedAt: null
      })),
      upsertClientMaterialAnalysis: vi.fn(),
      getCrmOrchestrator: vi.fn(async () => ({
        workspaceId: "workspace-demo",
        role: "crm_orchestrator" as const,
        model: "gpt-5.2",
        prompt: "Route CRM requests.",
        updatedAt: null
      })),
      upsertCrmOrchestrator: vi.fn(),
      getCrmEntityExtractor: vi.fn(async () => ({
        workspaceId: "workspace-demo",
        role: "crm_entity_extractor" as const,
        model: "gpt-5.1",
        prompt: "Extract CRM entities.",
        updatedAt: null
      })),
      upsertCrmEntityExtractor: vi.fn()
    };

    await expect(resolveTelegramAiSettings(store, "workspace-demo")).resolves.toEqual({
      clientMaterialAnalysis: expect.objectContaining({
        role: "client_material_analysis",
        model: "gpt-4.1",
        prompt: "Analyze source materials."
      }),
      crmOrchestrator: expect.objectContaining({
        role: "crm_orchestrator",
        model: "gpt-5.2",
        prompt: "Route CRM requests."
      }),
      crmEntityExtractor: expect.objectContaining({
        role: "crm_entity_extractor",
        model: "gpt-5.1",
        prompt: "Extract CRM entities."
      })
    });
    expect(store.getClientMaterialAnalysis).toHaveBeenCalledWith("workspace-demo");
    expect(store.getCrmOrchestrator).toHaveBeenCalledWith("workspace-demo");
    expect(store.getCrmEntityExtractor).toHaveBeenCalledWith("workspace-demo");
  });

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

  it("registers the Telegram bot command menu before polling updates", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/setMyCommands")) {
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }

      if (url.includes("/getUpdates")) {
        return { ok: true, status: 200, json: async () => ({ ok: true, result: [] }) };
      }

      throw new Error(`Unexpected URL ${url}`);
    });

    await expect(
      runTelegramWorkerOnce({
        allowedChatIds: new Set(["12345"]),
        botToken: "telegram-token",
        workspaceId: "workspace-demo",
        parser: { parseLead: vi.fn() },
        fetchImpl: fetchMock as unknown as typeof fetch
      })
    ).resolves.toEqual({ processed: 0, ignored: 0 });

    const setCommandsCall = fetchMock.mock.calls.find(([url]) => String(url).includes("/setMyCommands")) as
      | [string, { body?: unknown }]
      | undefined;
    expect(setCommandsCall).toBeTruthy();
    const body = JSON.parse(String(setCommandsCall?.[1]?.body));
    expect(body.commands).toEqual([
      { command: "newlead", description: "new lead" },
      { command: "searchlead", description: "search lead" }
    ]);
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
          crmBaseUrl: "https://crm.example.com",
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
          displayName: "Fam. Schneider - new_build in Chiemseeufer 7",
          language: "de",
          country: null,
          searchTags: ["fam_schneider", "new_build", "chiemseeufer_7"],
          bgfM2: 160,
          rawInput: expect.stringContaining("Telegram sources: telegram:12345:5")
        })
      }
    ]);
    const sendCall = fetchMock.mock.calls.find(([url]) => String(url).includes("/sendMessage")) as unknown as [
      string,
      { body?: unknown }
    ];
    const sendBody = JSON.parse(String(sendCall[1]?.body));
    expect(sendBody.text).toContain("<b>L-2026-002</b> created in CRM.");
    expect(sendBody.text).toContain("Lead name: <b>Fam. Schneider - new_build in Chiemseeufer 7</b>");
    expect(sendBody.text).toContain("Pricing: <b>standard</b>");
    expect(sendBody.text).not.toContain("Lead: <b>L-2026-002</b>");
    expect(sendBody.text).toContain("Standard EFH lead");
    expect(sendBody.text).not.toContain("Summary:");
    expect(sendBody.text).not.toContain("<b>Standard EFH lead</b>");
    expect(sendBody.text.indexOf("Pricing: <b>standard</b>")).toBeLessThan(sendBody.text.indexOf("Standard EFH lead"));
    expect(sendBody.text.indexOf("Standard EFH lead")).toBeLessThan(sendBody.text.indexOf("Status: <b>new</b>"));
    expect(sendBody.text.indexOf("Status: <b>new</b>")).toBeLessThan(sendBody.text.indexOf("KP fields ready: <b>yes</b>"));
    expect(sendBody.text.indexOf("KP fields ready: <b>yes</b>")).toBeLessThan(sendBody.text.indexOf("Request type: <b>new_build</b>"));
    expect(sendBody.text).toContain("Request type: <b>new_build</b>");
    expect(sendBody.text).not.toContain("Done, I created a lead in CRM.");
    expect(sendBody.text).not.toContain("<b>KP document</b>");
    expect(sendBody.reply_markup.inline_keyboard[0]).toContainEqual({ text: "CRM", url: "https://crm.example.com/leads?leadId=L-2026-002" });
    expect(sendBody.reply_markup.inline_keyboard[0]).toContainEqual({ text: "Undo", callback_data: "lead_undo:L-2026-002:5" });
  });

  it("runs CRM entity extraction after creating a Telegram lead and persists extracted context", async () => {
    const savedExtractions: unknown[] = [];
    const client = {
      lead: {
        findMany: vi.fn(async () => []),
        create: vi.fn(async () => ({ id: "lead-record-1", leadId: "L-2026-001", status: "new" }))
      }
    };
    const parser: OpenAiLeadParserClient = {
      parseLead: vi.fn(async () => ({
        clientName: "Artem",
        requestType: "renovation",
        urgency: "medium" as const,
        temperature: "warm" as const,
        bgfM2: 140,
        projectAddress: "Sochi",
        email: "artem@example.com",
        phone: null,
        missingData: [],
        summary: "Renovation lead in Sochi.",
        suggestedReply: "Danke."
      }))
    };
    const crmEntityExtractor = {
      extract: vi.fn(async () => ({
        facts: [{ type: "FACT" as const, label: "Preference", value: "Likes jazz", sourceText: "loves jazz", confidence: "high" as const }],
        events: [],
        followups: [
          {
            type: "FOLLOW_UP" as const,
            label: "Follow up",
            value: "Call Artem tomorrow",
            sourceText: "call tomorrow",
            confidence: "high" as const,
            title: "Call Artem",
            dueAt: "2026-06-03T09:00:00.000Z",
            recurrence: "none" as const,
            assigneeHint: null
          }
        ],
        people: [],
        organizations: [],
        tags: [{ type: "TAG" as const, label: "jazz", value: "jazz", sourceText: "jazz", confidence: "high" as const, normalizedKey: "hobby_jazz" }],
        leadNaming: { displayName: null, projectPlace: "Sochi", language: "ru", country: "Russia" },
        confidence: { overall: "high" as const },
        summary: "Found client preference and one follow-up."
      }))
    };
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/sendMessage")) {
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }

      throw new Error(`Unexpected URL ${url}`);
    });

    await processTelegramUpdates(
      [
        {
          update_id: 10,
          message: {
            message_id: 5,
            date: 1779296400,
            chat: { id: 12345 },
            text: "Need renovation offer for Artem in Sochi, he loves jazz and we should call tomorrow."
          }
        }
      ],
      {
        allowedChatIds: new Set(["12345"]),
        botToken: "telegram-token",
        workspaceId: "workspace-demo",
        parser,
        prisma: client,
        crmEntityExtractor,
        saveLeadEntityExtraction: async (input) => {
          savedExtractions.push(input);
        },
        fetchImpl: fetchMock as unknown as typeof fetch
      }
    );

    expect(client.lead.create).toHaveBeenCalled();
    expect(crmEntityExtractor.extract).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-demo",
        leadId: "L-2026-001",
        text: expect.stringContaining("Need renovation offer")
      })
    );
    expect(savedExtractions).toEqual([
      expect.objectContaining({
        workspaceId: "workspace-demo",
        leadRecordId: "lead-record-1",
        leadId: "L-2026-001",
        sourceChannel: "telegram",
        sourceMessageId: "telegram:12345:5",
        actorUserId: "telegram:12345",
        entities: expect.arrayContaining([
          expect.objectContaining({ type: "FACT", label: "Preference", value: "Likes jazz" }),
          expect.objectContaining({ type: "TAG", normalizedKey: "hobby_jazz" })
        ]),
        calendarActions: [
          expect.objectContaining({
            title: "Call Artem",
            dueAt: new Date("2026-06-03T09:00:00.000Z")
          })
        ],
        summary: expect.stringContaining("Found client preference")
      })
    ]);
  });

  it("keeps Telegram lead confirmation summaries compact and unbolded before fields", async () => {
    const longSummary = `${"A".repeat(310)} tail`;
    const client = {
      lead: {
        findMany: vi.fn(async () => []),
        create: vi.fn(async () => ({ id: "lead-record-1", leadId: "L-2026-010", status: "needs_data" }))
      }
    };
    const parser: OpenAiLeadParserClient = {
      parseLead: vi.fn(async () => ({
        clientName: "Long Summary",
        requestType: "new_build",
        urgency: "medium" as const,
        temperature: "warm" as const,
        bgfM2: undefined,
        projectAddress: undefined,
        email: null,
        phone: null,
        missingData: ["projectAddress"],
        summary: longSummary,
        suggestedReply: "Bitte Adresse senden."
      }))
    };
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/sendMessage")) {
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }

      throw new Error(`Unexpected URL ${url}`);
    });

    await processTelegramUpdates(
      [
        {
          update_id: 12,
          message: {
            message_id: 6,
            date: 1779296400,
            chat: { id: 54321 },
            text: "Need EFH offer"
          }
        }
      ],
      {
        allowedChatIds: new Set(["54321"]),
        botToken: "telegram-token",
        workspaceId: "workspace-demo",
        crmBaseUrl: "https://crm.example.com",
        parser,
        prisma: client,
        fetchImpl: fetchMock as unknown as typeof fetch
      }
    );

    const sendCall = fetchMock.mock.calls.find(([url]) => String(url).includes("/sendMessage")) as unknown as [
      string,
      { body?: unknown }
    ];
    const sendBody = JSON.parse(String(sendCall[1]?.body));
    const lines = String(sendBody.text).split("\n");
    const summaryLine = lines.find((line) => line.startsWith("AAA"));
    expect(summaryLine).toHaveLength(300);
    expect(summaryLine).toMatch(/\.\.\.$/);
    expect(sendBody.text).not.toContain("Summary:");
    expect(sendBody.text).not.toContain("tail");
    expect(sendBody.text.indexOf(summaryLine ?? "")).toBeLessThan(sendBody.text.indexOf("Status: <b>needs_data</b>"));
  });

  it("routes standalone theme questions through Telegram support instead of capability handling", async () => {
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
          crmBaseUrl: "https://crm.example.com",
          parser,
          prisma: client,
          fetchImpl: fetchMock as unknown as typeof fetch
        }
      )
    ).resolves.toEqual({ processed: 0, ignored: 1, lastUpdateId: 12 });

    expect(parser.parseLead).not.toHaveBeenCalled();
    expect(client.lead.create).not.toHaveBeenCalled();
    const sendCall = fetchMock.mock.calls[0] as unknown as [string, { body?: unknown }];
    const body = JSON.parse(String(sendCall[1]?.body));
    expect(body.text).toContain("Use new lead");
    expect(body.text).toContain("search lead");
    expect(body.text).not.toContain("Nocturne");
    expect(body.reply_markup).toBeUndefined();
  });

  it("creates a lead from a batched source-material conversation even if one message mentions themes", async () => {
    const created: unknown[] = [];
    const client = {
      lead: {
        findMany: vi.fn(async () => []),
        create: vi.fn(async (args: unknown) => {
          created.push(args);
          return { id: "lead-record-7", leadId: "L-2026-007", status: "new" };
        })
      }
    };
    const parser: OpenAiLeadParserClient = {
      parseLead: vi.fn(async (message) => ({
        clientName: "Self Storage GmbH",
        requestType: "self storage feasibility",
        urgency: "medium" as const,
        temperature: "warm" as const,
        bgfM2: 1400,
        projectAddress: "Bayern",
        missingData: [],
        summary: "Self storage feasibility with 1300-1400 m2 BGF",
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
            update_id: 21,
            message: {
              message_id: 11,
              date: 1779296400,
              chat: { id: 12345 },
              text: "Есть вопрос по self storage, нужно понять BGF и посадку здания."
            }
          },
          {
            update_id: 22,
            message: {
              message_id: 12,
              date: 1779296460,
              chat: { id: 12345 },
              text: "1000-1500 кв м, в идеале 1300-1400 кв м BGF. Тема для вечерней проверки не важна, это один лид."
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
    ).resolves.toEqual({ processed: 1, ignored: 0, lastUpdateId: 22 });

    expect(parser.parseLead).toHaveBeenCalledTimes(1);
    const parseLeadMock = vi.mocked(parser.parseLead);
    expect(String(parseLeadMock.mock.calls[0]?.[0].text)).toContain("self storage");
    expect(String(parseLeadMock.mock.calls[0]?.[0].text)).toContain("1300-1400");
    expect(created).toHaveLength(1);
    const sendMessageCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes("/sendMessage")) as unknown as Array<
      [string, { body?: unknown }]
    >;
    const sendBodies = sendMessageCalls.map(([, init]) => JSON.parse(String(init.body)));
    expect(sendBodies[0].text).toContain("I received several files/messages");
    expect(sendBodies.at(-1).text).toContain("<b>L-2026-007</b> created in CRM.");
    expect(sendBodies.at(-1).text).not.toContain("Nocturne");
  });

  it("routes Telegram table export requests through the lead search/filter agent", async () => {
    const client = {
      lead: {
        findMany: vi.fn(async () => [
          {
            id: "lead-record-1",
            leadId: "L-2026-001",
            createdDate: new Date("2026-05-15T10:00:00.000Z"),
            status: "new",
            temperature: "warm",
            requestType: "EFH Neubau",
            projectAddress: "Munich",
            client: { name: "Anna Meyer" },
            rawInput: "old"
          },
          {
            id: "lead-record-2",
            leadId: "L-2026-002",
            createdDate: new Date("2026-06-01T10:00:00.000Z"),
            status: "new",
            temperature: "hot",
            requestType: "Office",
            projectAddress: "Berlin",
            client: { name: "Buro GmbH" },
            rawInput: "old"
          }
        ]),
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
            update_id: 23,
            message: {
              message_id: 13,
              date: 1779296520,
              chat: { id: 12345 },
              text: "Send me CSV export of warm leads from last month"
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
    ).resolves.toEqual({ processed: 0, ignored: 1, lastUpdateId: 23 });

    expect(parser.parseLead).not.toHaveBeenCalled();
    expect(client.lead.create).not.toHaveBeenCalled();
    const sendCall = fetchMock.mock.calls[0] as unknown as [string, { body?: unknown }];
    const body = JSON.parse(String(sendCall[1]?.body));
    expect(body.text).toContain("Found 1 leads");
    expect(body.text).toContain("L-2026-001");
    expect(body.text).not.toContain("L-2026-002");
    expect(body.reply_markup).toEqual({
      inline_keyboard: [
        [
          { text: "Anna Meyer", callback_data: "lead_open:L-2026-001" },
          { text: "Open results in CRM", url: "https://crm.example.com/leads?date=last_month&temperature=warm" }
        ],
        [{ text: "Download CSV", url: "https://crm.example.com/exports/leads?date=last_month&temperature=warm" }]
      ]
    });
  });

  it("returns compact Telegram lead search results with CRM buttons", async () => {
    const client = {
      lead: {
        findMany: vi.fn(async () => [
          {
            id: "lead-record-1",
            leadId: "L-2026-010",
            displayName: "Frau Schneider - Neubau EFH am Chiemsee",
            searchTags: ["chiemsee", "new_build"],
            createdDate: new Date("2026-06-02T10:00:00.000Z"),
            status: "new",
            temperature: "warm",
            requestType: "Neubau EFH",
            projectAddress: "Bad Aibling",
            client: { name: "Frau Schneider" },
            rawInput: "telegram"
          },
          {
            id: "lead-record-2",
            leadId: "L-2026-011",
            displayName: "Buro GmbH - Office renovation in Berlin",
            searchTags: ["office_renovation", "berlin"],
            createdDate: new Date("2026-06-01T10:00:00.000Z"),
            status: "needs_data",
            temperature: "cold",
            requestType: "Office renovation",
            projectAddress: "Berlin",
            client: { name: "Buro GmbH" },
            rawInput: "telegram"
          }
        ]),
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
              message_id: 14,
              date: 1779296520,
              chat: { id: 12345 },
              text: "Покажи последние 10 лидов"
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
    ).resolves.toEqual({ processed: 0, ignored: 1, lastUpdateId: 24 });

    expect(parser.parseLead).not.toHaveBeenCalled();
    expect(client.lead.create).not.toHaveBeenCalled();
    const sendCall = fetchMock.mock.calls[0] as unknown as [string, { body?: unknown }];
    const body = JSON.parse(String(sendCall[1]?.body));
    expect(body.text).toContain("Found 2 leads");
    expect(body.text).toContain("Frau Schneider - Neubau EFH am Chiemsee");
    expect(body.reply_markup).toEqual({
      inline_keyboard: [
        [
          { text: "Frau Schneider - Neubau EFH...", callback_data: "lead_open:L-2026-010" },
          { text: "Buro GmbH - Office renovation...", callback_data: "lead_open:L-2026-011" }
        ],
        [{ text: "Open results in CRM", url: "https://crm.example.com/leads" }]
      ]
    });
  });

  it("finds Telegram leads by human lead title fragments and shows title buttons", async () => {
    const client = {
      lead: {
        findMany: vi.fn(async () => [
          {
            id: "lead-record-1",
            leadId: "L-2026-010",
            displayName: "Frau Schneider - Neubau EFH am Chiemsee",
            searchTags: ["schneider", "chiemsee", "efh", "haus", "lake"],
            createdDate: new Date("2026-06-02T10:00:00.000Z"),
            status: "new",
            temperature: "warm",
            requestType: "Neubau EFH",
            projectAddress: "Bad Aibling",
            client: { name: "Frau Schneider" },
            rawInput: "telegram"
          },
          {
            id: "lead-record-2",
            leadId: "L-2026-011",
            displayName: "Buro GmbH - Office renovation in Berlin",
            searchTags: ["office_renovation", "berlin"],
            createdDate: new Date("2026-06-01T10:00:00.000Z"),
            status: "needs_data",
            temperature: "cold",
            requestType: "Office renovation",
            projectAddress: "Berlin",
            client: { name: "Buro GmbH" },
            rawInput: "telegram"
          }
        ]),
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
            update_id: 25,
            message: {
              message_id: 15,
              date: 1779296520,
              chat: { id: 12345 },
              text: "Find lead Schneider house lake"
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
    ).resolves.toEqual({ processed: 0, ignored: 1, lastUpdateId: 25 });

    expect(parser.parseLead).not.toHaveBeenCalled();
    expect(client.lead.create).not.toHaveBeenCalled();
    const sendCall = fetchMock.mock.calls[0] as unknown as [string, { body?: unknown }];
    const body = JSON.parse(String(sendCall[1]?.body));
    expect(body.text).toContain("Found 1 leads");
    expect(body.text).toContain("Frau Schneider - Neubau EFH am Chiemsee");
    expect(body.text).not.toContain("Buro GmbH");
    expect(body.reply_markup).toEqual({
      inline_keyboard: [
        [
          { text: "Frau Schneider - Neubau EFH...", callback_data: "lead_open:L-2026-010" },
          { text: "Open results in CRM", url: "https://crm.example.com/leads?leadSearch=Schneider+house+lake" }
        ]
      ]
    });
  });

  it("asks which lead to update for standalone client context instead of creating a draft lead", async () => {
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
            update_id: 13,
            message: {
              message_id: 8,
              date: 1779296400,
              chat: { id: 12345 },
              text:
                "\u0414\u043e\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044c\u043d\u0430\u044f \u0438\u043d\u0444\u043e\u0440\u043c\u0430\u0446\u0438\u044f: \u0432\u0447\u0435\u0440\u0430 \u0432\u0438\u0434\u0435\u043b\u0438 \u043a\u043b\u0438\u0435\u043d\u0442\u0430 \u043d\u0430 \u0432\u044b\u0441\u0442\u0430\u0432\u043a\u0435, \u043e\u043d \u043b\u044e\u0431\u0438\u0442 \u0434\u0436\u0430\u0437."
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
    ).resolves.toEqual({ processed: 0, ignored: 1, lastUpdateId: 13 });

    expect(parser.parseLead).not.toHaveBeenCalled();
    expect(client.lead.create).not.toHaveBeenCalled();
    const sendCall = fetchMock.mock.calls[0] as unknown as [string, { body?: unknown }];
    const body = JSON.parse(String(sendCall[1]?.body));
    expect(body.text).toContain("Which lead should I save this note to?");
  });

  it("routes Telegram search requests without parsing them as new leads", async () => {
    const client = {
      lead: {
        findMany: vi.fn(async () => [
          {
            id: "lead-record-phone",
            leadId: "L-2026-014",
            displayName: "Irina Schneider - Neubau EFH",
            searchTags: ["irina_schneider", "neubau_efh"],
            createdDate: new Date("2026-06-02T10:00:00.000Z"),
            status: "new",
            temperature: "warm",
            requestType: "Neubau EFH",
            projectAddress: "Bad Aibling",
            email: "irina.schneider@example.com",
            phone: "+49 160 4442211",
            client: { name: "Irina Schneider", email: "irina.schneider@example.com", phone: "+49 160 4442211" },
            rawInput: "telegram"
          }
        ]),
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
            update_id: 14,
            message: {
              message_id: 8,
              date: 1779296400,
              chat: { id: 12345 },
              text: "Find the client by phone +49 160 4442211"
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
    ).resolves.toEqual({ processed: 0, ignored: 1, lastUpdateId: 14 });

    expect(parser.parseLead).not.toHaveBeenCalled();
    expect(client.lead.create).not.toHaveBeenCalled();
    const sendCall = fetchMock.mock.calls[0] as unknown as [string, { body?: unknown }];
    const body = JSON.parse(String(sendCall[1]?.body));
    expect(body.text).toContain("Found 1 leads");
    expect(body.text).toContain("Irina Schneider - Neubau EFH");
    expect(body.text).not.toContain("Lead Search Agent");
    expect(body.reply_markup.inline_keyboard[0][0]).toEqual({
      text: "Irina Schneider - Neubau EFH",
      callback_data: "lead_open:L-2026-014"
    });
  });

  it("answers Telegram search capability questions with search examples instead of limited-action fallback", async () => {
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
            update_id: 241,
            message: {
              message_id: 141,
              date: 1779296520,
              chat: { id: 12345 },
              text: "Does search work?"
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
    ).resolves.toEqual({ processed: 0, ignored: 1, lastUpdateId: 241 });

    expect(parser.parseLead).not.toHaveBeenCalled();
    const sendCall = fetchMock.mock.calls[0] as unknown as [string, { body?: unknown }];
    const body = JSON.parse(String(sendCall[1]?.body));
    expect(body.text).toContain("Search works");
    expect(body.text).toContain("search lead");
    expect(body.text).toContain("show last 10 leads");
    expect(body.text).not.toContain("Telegram actions are limited right now.");
  });

  it("does not enter search mode from the old /search command without lead", async () => {
    const client = {
      lead: {
        findMany: vi.fn(async () => [
          {
            id: "lead-record-1",
            leadId: "L-2026-010",
            displayName: "Frau Schneider - Neubau EFH am Chiemsee",
            searchTags: ["schneider"],
            createdDate: new Date("2026-06-02T10:00:00.000Z"),
            status: "new",
            temperature: "warm",
            requestType: "Neubau EFH",
            projectAddress: "Bad Aibling",
            client: { name: "Frau Schneider" },
            rawInput: "telegram"
          }
        ]),
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
        missingData: ["clientName", "requestType", "projectAddress"],
        summary: "No lead source material detected.",
        suggestedReply: "Send search lead to search leads."
      }))
    };
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
      fetchImpl: fetchMock as unknown as typeof fetch
    };

    await processTelegramUpdates(
      [
        {
          update_id: 245,
          message: {
            message_id: 145,
            date: 1779296520,
            chat: { id: 12345 },
            text: "/search"
          }
        }
      ],
      config
    );
    await processTelegramUpdates(
      [
        {
          update_id: 246,
          message: {
            message_id: 146,
            date: 1779296580,
            chat: { id: 12345 },
            text: "Schneider"
          }
        }
      ],
      config
    );

    const sendBodies = (fetchMock.mock.calls as unknown as Array<[string, { body?: unknown }]>)
      .filter(([url]) => String(url).includes("/sendMessage"))
      .map(([, init]) => JSON.parse(String(init.body)));
    expect(sendBodies[0].text).toContain("search lead");
    expect(sendBodies.some((body) => String(body.text).includes("Found 1 leads"))).toBe(false);
  });

  it("keeps a Telegram chat in search mode after search lead and searches the next message as a query", async () => {
    const client = {
      lead: {
        findMany: vi.fn(async () => [
          {
            id: "lead-record-1",
            leadId: "L-2026-010",
            displayName: "Frau Schneider - Neubau EFH am Chiemsee",
            searchTags: ["schneider", "chiemsee", "efh", "haus", "lake"],
            createdDate: new Date("2026-06-02T10:00:00.000Z"),
            status: "new",
            temperature: "warm",
            requestType: "Neubau EFH",
            projectAddress: "Bad Aibling",
            client: { name: "Frau Schneider" },
            rawInput: "telegram"
          }
        ]),
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
    const config = {
      allowedChatIds: new Set(["12345"]),
      botToken: "telegram-token",
      workspaceId: "workspace-demo",
      crmBaseUrl: "https://crm.example.com",
      parser,
      prisma: client,
      fetchImpl: fetchMock as unknown as typeof fetch
    };

    await processTelegramUpdates(
      [
        {
          update_id: 242,
          message: {
            message_id: 142,
            date: 1779296520,
            chat: { id: 12345 },
              text: "search lead"
          }
        }
      ],
      config
    );
    await processTelegramUpdates(
      [
        {
          update_id: 243,
          message: {
            message_id: 143,
            date: 1779296580,
            chat: { id: 12345 },
            text: "Schneider lake"
          }
        }
      ],
      config
    );

    expect(parser.parseLead).not.toHaveBeenCalled();
    const sendBodies = (fetchMock.mock.calls as unknown as Array<[string, { body?: unknown }]>)
      .filter(([url]) => String(url).includes("/sendMessage"))
      .map(([, init]) => JSON.parse(String(init.body)));
    expect(sendBodies[0].text).toContain("Search mode.");
    expect(sendBodies[0].text).toContain("Latest 5 leads");
    expect(sendBodies[0].reply_markup.inline_keyboard[0][0]).toEqual({
      text: "Frau Schneider - Neubau EFH...",
      callback_data: "lead_open:L-2026-010"
    });
    expect(sendBodies[1].text).toContain("Found 1 leads");
    expect(sendBodies[1].text).toContain("<b>L-2026-010</b>");
    expect(sendBodies[1].reply_markup.inline_keyboard[0][0]).toEqual({
      text: "Frau Schneider - Neubau EFH...",
      callback_data: "lead_open:L-2026-010"
    });
    expect(sendBodies[1].reply_markup.inline_keyboard.flat()).toContainEqual({
      text: "Open results in CRM",
      url: "https://crm.example.com/leads?leadSearch=Schneider+lake"
    });
  });

  it("opens a selected Telegram search result as a lead card in Telegram", async () => {
    const client = {
      lead: {
        findMany: vi.fn(async () => [
          {
            id: "lead-record-1",
            leadId: "L-2026-010",
            displayName: "Frau Schneider - Neubau EFH am Chiemsee",
            searchTags: ["schneider", "chiemsee"],
            createdDate: new Date("2026-06-02T10:00:00.000Z"),
            status: "new",
            temperature: "warm",
            requestType: "Neubau EFH",
            projectAddress: "Bad Aibling",
            bgfM2: 195,
            missingData: [],
            client: { name: "Frau Schneider", email: "frau.schneider@example.com", phone: "+49 160 111222" },
            rawInput: "telegram"
          }
        ]),
        create: vi.fn()
      }
    };
    const parser: OpenAiLeadParserClient = {
      parseLead: vi.fn()
    };
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/answerCallbackQuery") || url.includes("/sendMessage")) {
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }

      throw new Error(`Unexpected URL ${url}`);
    });

    await expect(
      processTelegramUpdates(
        [
          {
            update_id: 244,
            callback_query: {
              id: "callback-open-lead",
              data: "lead_open:L-2026-010",
              message: {
                message_id: 144,
                date: 1779296580,
                chat: { id: 12345 }
              }
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
    ).resolves.toMatchObject({ processed: 1, lastUpdateId: 244 });

    const sendCall = fetchMock.mock.calls.find(([url]) => String(url).includes("/sendMessage")) as unknown as [string, { body?: unknown }];
    const body = JSON.parse(String(sendCall[1]?.body));
    expect(body.text).toContain("<b>L-2026-010</b>");
    expect(body.text).toContain("Frau Schneider - Neubau EFH am Chiemsee");
    expect(body.text).toContain("Reply to this lead card to update the lead");
    expect(body.reply_markup.inline_keyboard[0][0]).toEqual({
      text: "CRM",
      url: "https://crm.example.com/leads?leadId=L-2026-010"
    });
  });

  it("uses the CRM orchestrator fallback for ambiguous Telegram search requests", async () => {
    const client = {
      lead: {
        findMany: vi.fn(async () => []),
        create: vi.fn()
      }
    };
    const parser: OpenAiLeadParserClient = {
      parseLead: vi.fn()
    };
    const crmOrchestrator = {
      route: vi.fn(async () => ({
        intent: "SEARCH_LEAD" as const,
        reasoning: "The user asks to find existing CRM information.",
        action: "Lead Search Agent" as const,
        status: "ready" as const,
        message: "I will search for that lead."
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
            update_id: 15,
            message: {
              message_id: 9,
              date: 1779296400,
              chat: { id: 12345 },
              text: "Can you retrieve what we know about the person from yesterday?"
            }
          }
        ],
        {
          allowedChatIds: new Set(["12345"]),
          botToken: "telegram-token",
          workspaceId: "workspace-demo",
          crmBaseUrl: "https://crm.example.com",
          parser,
          crmOrchestrator,
          prisma: client,
          fetchImpl: fetchMock as unknown as typeof fetch
        }
      )
    ).resolves.toEqual({ processed: 0, ignored: 1, lastUpdateId: 15 });

    expect(crmOrchestrator.route).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "telegram",
        content: "Can you retrieve what we know about the person from yesterday?"
      })
    );
    expect(parser.parseLead).not.toHaveBeenCalled();
    expect(client.lead.create).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.telegram.org/bottelegram-token/sendMessage",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("Telegram actions are limited right now.")
      })
    );
    const sendCall = fetchMock.mock.calls[0] as unknown as [string, { body?: unknown }];
    const body = JSON.parse(String(sendCall[1]?.body));
    expect(body.text).toContain("Use new lead");
    expect(body.text).toContain("search lead");
    expect(body.text).not.toContain("Lead Search Agent");
  });

  it("runs explicit Telegram search even when the local orchestrator would ask a clarification", async () => {
    const client = {
      lead: {
        findMany: vi.fn(async () => [
          {
            id: "lead-record-1",
            leadId: "L-2026-777",
            displayName: "Schneider - EFH Neubau in Bad Aibling",
            searchTags: ["schneider", "efh", "bad_aibling"],
            createdDate: new Date("2026-06-02T10:00:00.000Z"),
            status: "new",
            temperature: "warm",
            requestType: "EFH Neubau",
            projectAddress: "Bad Aibling",
            client: { name: "Schneider" },
            rawInput: "telegram"
          }
        ]),
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
            update_id: 151,
            message: {
              message_id: 91,
              date: 1779296400,
              chat: { id: 12345 },
              text: "Find project Schneider EFH"
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
    ).resolves.toEqual({ processed: 0, ignored: 1, lastUpdateId: 151 });

    const sendCall = fetchMock.mock.calls[0] as unknown as [string, { body?: unknown }];
    const body = JSON.parse(String(sendCall[1]?.body));
    expect(parser.parseLead).not.toHaveBeenCalled();
    expect(body.text).toContain("Found 1 leads");
    expect(body.text).not.toContain("Telegram actions are limited right now.");
    expect(body.reply_markup.inline_keyboard[0][0]).toEqual({
      text: "Schneider - EFH Neubau in...",
      callback_data: "lead_open:L-2026-777"
    });
  });

  it("asks the CRM orchestrator clarification instead of creating a lead", async () => {
    const client = {
      lead: {
        findMany: vi.fn(async () => []),
        create: vi.fn()
      }
    };
    const parser: OpenAiLeadParserClient = {
      parseLead: vi.fn()
    };
    const crmOrchestrator = {
      route: vi.fn(async () => ({
        intent: "CLARIFICATION_REQUIRED" as const,
        reasoning: "The requested action is unclear.",
        action: "clarification" as const,
        status: "need_clarification" as const,
        message: "Do you want me to create a new lead or update an existing one?"
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
            update_id: 16,
            message: {
              message_id: 10,
              date: 1779296400,
              chat: { id: 12345 },
              text: "Let's do that thing for the client"
            }
          }
        ],
        {
          allowedChatIds: new Set(["12345"]),
          botToken: "telegram-token",
          workspaceId: "workspace-demo",
          crmBaseUrl: "https://crm.example.com",
          parser,
          crmOrchestrator,
          prisma: client,
          fetchImpl: fetchMock as unknown as typeof fetch
        }
      )
    ).resolves.toEqual({ processed: 0, ignored: 1, lastUpdateId: 16 });

    expect(parser.parseLead).not.toHaveBeenCalled();
    expect(client.lead.create).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.telegram.org/bottelegram-token/sendMessage",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("Do you want me to create a new lead or update an existing one?")
      })
    );
  });

  it("falls back safely when the CRM orchestrator returns no usable decision", async () => {
    const client = {
      lead: {
        findMany: vi.fn(async () => []),
        create: vi.fn()
      }
    };
    const parser: OpenAiLeadParserClient = {
      parseLead: vi.fn()
    };
    const crmOrchestrator = {
      route: vi.fn(async () => undefined as never)
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
            update_id: 18,
            message: {
              message_id: 12,
              date: 1779296400,
              chat: { id: 12345 },
              text: "Can you handle this CRM thing?"
            }
          }
        ],
        {
          allowedChatIds: new Set(["12345"]),
          botToken: "telegram-token",
          workspaceId: "workspace-demo",
          crmBaseUrl: "https://crm.example.com",
          parser,
          crmOrchestrator,
          prisma: client,
          fetchImpl: fetchMock as unknown as typeof fetch
        }
      )
    ).resolves.toEqual({ processed: 0, ignored: 1, lastUpdateId: 18 });

    expect(crmOrchestrator.route).toHaveBeenCalled();
    expect(parser.parseLead).not.toHaveBeenCalled();
    expect(client.lead.create).not.toHaveBeenCalled();
    const sendCall = fetchMock.mock.calls[0] as unknown as [string, { body?: unknown }];
    const body = JSON.parse(String(sendCall[1]?.body));
    expect(body.text).toContain("Telegram actions are limited right now.");
    expect(body.text).toContain("Use new lead");
    expect(body.text).toContain("search lead");
  });

  it("keeps obvious Telegram lead creation on the parser path without CRM orchestrator fallback", async () => {
    const client = {
      lead: {
        findMany: vi.fn(async () => []),
        create: vi.fn(async () => ({ id: "lead-record-17", leadId: "L-2026-017", status: "new" }))
      }
    };
    const parser: OpenAiLeadParserClient = {
      parseLead: vi.fn(async () => ({
        clientName: "Irina Schneider",
        requestType: "new_build",
        urgency: "medium" as const,
        temperature: "warm" as const,
        bgfM2: 195,
        projectAddress: "Bad Aibling, Gartenweg 9",
        email: "irina.schneider@example.com",
        phone: "+49 160 4442211",
        missingData: [],
        summary: "EFH lead",
        suggestedReply: "Lead created."
      }))
    };
    const crmOrchestrator = {
      route: vi.fn()
    };
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/sendMessage")) {
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }

      throw new Error(`Unexpected URL ${url}`);
    });

    await processTelegramUpdates(
      [
        {
          update_id: 17,
          message: {
            message_id: 11,
            date: 1779296400,
            chat: { id: 12345 },
            text: "Здравствуйте, меня зовут Ирина Шнайдер, контакт irina.schneider@example.com, +49 160 4442211. Нужен Neubau EFH в Bad Aibling, Gartenweg 9, BGF 195 м2."
          }
        }
      ],
      {
        allowedChatIds: new Set(["12345"]),
        botToken: "telegram-token",
        workspaceId: "workspace-demo",
        crmBaseUrl: "https://crm.example.com",
        parser,
        crmOrchestrator,
        prisma: client,
        fetchImpl: fetchMock as unknown as typeof fetch
      }
    );

    expect(crmOrchestrator.route).not.toHaveBeenCalled();
    expect(parser.parseLead).toHaveBeenCalled();
    expect(client.lead.create).toHaveBeenCalled();
  });

  it("answers duplicate Telegram source messages with the existing CRM lead link", async () => {
    const client = {
      lead: {
        findMany: vi.fn(async () => [
          {
            id: "lead-record-2",
            leadId: "L-2026-002",
            rawInput: "Need EFH offer\nTelegram sources: telegram:12345:5"
          }
        ]),
        create: vi.fn()
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
            update_id: 13,
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
          crmBaseUrl: "https://crm.example.com",
          parser,
          prisma: client,
          fetchImpl: fetchMock as unknown as typeof fetch
        }
      )
    ).resolves.toEqual({ processed: 0, ignored: 1, lastUpdateId: 13 });

    expect(parser.parseLead).not.toHaveBeenCalled();
    expect(client.lead.create).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.telegram.org/bottelegram-token/sendMessage",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("Lead <b>L-2026-002</b> already exists")
      })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.telegram.org/bottelegram-token/sendMessage",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("https://crm.example.com/leads?leadId=L-2026-002")
      })
    );
  });

  it("updates an existing lead when new Telegram material matches its client and address", async () => {
    const updates: unknown[] = [];
    const client = {
      lead: {
        findMany: vi.fn(async (args: unknown) => {
          const where = (args as { where?: { OR?: unknown } }).where;
          if (where?.OR) {
            return [];
          }

          return [
            {
              id: "lead-record-35",
              leadId: "L-2026-035",
              status: "needs_data",
              rawInput: "Irina Schneider asks for Neubau EFH",
              clientName: "Irina Schneider",
              projectAddress: "Bad Aibling, Gartenweg 9",
              missingData: ["bgfM2"]
            }
          ];
        }),
        create: vi.fn(),
        update: vi.fn(async (args: unknown) => {
          updates.push(args);
          return { id: "lead-record-35", leadId: "L-2026-035", status: "new" };
        })
      }
    };
    const parser: OpenAiLeadParserClient = {
      parseLead: vi.fn(async () => ({
        clientName: "Irina Schneider",
        requestType: "new_build",
        urgency: "medium" as const,
        temperature: "warm" as const,
        bgfM2: 195,
        projectAddress: "Bad Aibling, Gartenweg 9",
        email: "irina.schneider@example.com",
        phone: null,
        missingData: [],
        summary: "Adds missing BGF",
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
            update_id: 14,
            message: {
              message_id: 8,
              date: 1779296400,
              chat: { id: 12345 },
              text: "Irina Schneider, Bad Aibling Gartenweg 9, BGF 195"
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
    ).resolves.toEqual({ processed: 1, ignored: 0, lastUpdateId: 14 });

    expect(client.lead.create).not.toHaveBeenCalled();
    expect(updates[0]).toEqual({
      where: { id: "lead-record-35" },
      data: expect.objectContaining({
        projectAddress: "Bad Aibling, Gartenweg 9",
        bgfM2: 195,
        status: "new"
      })
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.telegram.org/bottelegram-token/sendMessage",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("<b>L-2026-035</b> updated in CRM.")
      })
    );
  });

  it("asks for clarification when Telegram material only partially matches an existing lead", async () => {
    const client = {
      lead: {
        findMany: vi.fn(async (args: unknown) => {
          const where = (args as { where?: { OR?: unknown } }).where;
          if (where?.OR) {
            return [];
          }

          return [
            {
              id: "lead-record-35",
              leadId: "L-2026-035",
              status: "needs_data",
              rawInput: "Irina Schneider, Gartenweg 9",
              missingData: ["bgfM2"]
            }
          ];
        }),
        create: vi.fn(),
        update: vi.fn()
      }
    };
    const parser: OpenAiLeadParserClient = {
      parseLead: vi.fn(async () => ({
        clientName: "",
        requestType: "new_build",
        urgency: "medium" as const,
        temperature: "warm" as const,
        bgfM2: 195,
        projectAddress: "Gartenweg 9",
        email: null,
        phone: null,
        missingData: ["clientName"],
        summary: "Partial matching source",
        suggestedReply: "Clarify."
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
            update_id: 15,
            message: {
              message_id: 9,
              date: 1779296400,
              chat: { id: 12345 },
              text: "Gartenweg 9, BGF 195"
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
    ).resolves.toEqual({ processed: 0, ignored: 1, lastUpdateId: 15 });

    expect(client.lead.create).not.toHaveBeenCalled();
    expect(client.lead.update).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.telegram.org/bottelegram-token/sendMessage",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("This may belong to lead <b>L-2026-035</b>")
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
    expect(sendBody.text).toContain("Missing for KP: <b>budget</b>");
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
        leadSummary: "Voice message contains a complete EFH request for Gartenweg 9.",
        documentSummaries: [
          {
            fileName: "telegram-voice-501.ogg",
            kind: "audio" as const,
            summary: "Audio confirms address, BGF, and budget for the commercial proposal.",
            transcript: "Nuzhen proekt doma Gartenweg 9, BGF 190, budget 32000 EUR.",
            storageKey: "workspaces/workspace-demo/telegram-source/12345/501-voice-file-telegram-voice-501.ogg",
            sourceUrl: null
          }
        ],
        suggestedReply: "Ready."
      }))
    };
    const audioTranscriber = {
      transcribe: vi.fn(async () => ({ text: "Нужен проект дома Gartenweg 9, BGF 190, бюджет 32000 EUR." }))
    };
    const saveSourceAttachment = vi.fn(async () => ({
      attachmentId: "attachment-voice-source-501",
      storageKey: "workspaces/workspace-demo/telegram-source/12345/501-voice-file-telegram-voice-501.ogg"
    }));
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
          saveSourceAttachment,
          fetchImpl: fetchMock as unknown as typeof fetch
        }
      )
    ).resolves.toEqual({ processed: 1, ignored: 0, lastUpdateId: 50 });

    expect(saveSourceAttachment).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-demo",
        chatId: "12345",
        messageId: 501,
        fileId: "voice-file",
        kind: "audio",
        fileName: "telegram-voice-501.ogg",
        mimeType: "audio/ogg",
        body: new TextEncoder().encode("voice bytes"),
        requestedByUserId: "telegram:12345"
      })
    );
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
          rawInput: expect.stringContaining("Telegram attachment 1: audio (telegram-voice-501.ogg, source voice-file, saved attachment-voice-source-501)")
        })
      })
    );
    expect(created[0]).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          rawInput: expect.stringContaining("Lead summary: Voice message contains a complete EFH request for Gartenweg 9.")
        })
      })
    );
    expect(created[0]).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          rawInput: expect.stringContaining(
            "Source material summaries:\n- telegram-voice-501.ogg: Audio confirms address, BGF, and budget for the commercial proposal."
          )
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

  it("transcribes a Telegram audio file sent as a document before creating a CRM lead", async () => {
    const created: unknown[] = [];
    const client = {
      lead: {
        findMany: vi.fn(async () => []),
        create: vi.fn(async (args: unknown) => {
          created.push(args);
          return { id: "lead-record-audio-file", leadId: "L-2026-001", status: "new" };
        })
      }
    };
    const parser: OpenAiLeadParserClient = {
      parseLead: vi.fn(async (input) => ({
        clientName: "Irina Audio",
        requestType: "new_build",
        urgency: "high" as const,
        temperature: "hot" as const,
        bgfM2: 195,
        projectAddress: "Gartenweg 9, Bad Aibling",
        email: "irina@example.com",
        phone: "+49 160 4442211",
        missingData: [],
        summary: input.text,
        suggestedReply: "Ready."
      }))
    };
    const audioTranscriber = {
      transcribe: vi.fn(async () => ({
        text: "Ирина Шнайдер просит КП на Neubau EFH, Gartenweg 9 Bad Aibling, BGF 195 м2, бюджет 32000 EUR."
      }))
    };
    const saveSourceAttachment = vi.fn(async () => ({
      attachmentId: "attachment-audio-document-601",
      storageKey: "workspaces/workspace-demo/telegram-source/12345/601-audio-document-client-brief.mp3"
    }));
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/getFile")) {
        return { ok: true, status: 200, json: async () => ({ ok: true, result: { file_path: "documents/client-brief.mp3" } }) };
      }

      if (url.includes("/file/")) {
        return { ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode("mp3 bytes").buffer };
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
            update_id: 60,
            message: {
              message_id: 601,
              date: 1779299300,
              chat: { id: 12345 },
              document: { file_id: "audio-document", file_name: "client-brief.mp3", mime_type: "audio/mpeg" }
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
          saveSourceAttachment,
          fetchImpl: fetchMock as unknown as typeof fetch
        }
      )
    ).resolves.toEqual({ processed: 1, ignored: 0, lastUpdateId: 60 });

    expect(saveSourceAttachment).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: 601,
        fileId: "audio-document",
        kind: "audio",
        fileName: "client-brief.mp3",
        mimeType: "audio/mpeg",
        body: new TextEncoder().encode("mp3 bytes")
      })
    );
    expect(audioTranscriber.transcribe).toHaveBeenCalledWith(
      expect.objectContaining({
        base64: Buffer.from("mp3 bytes").toString("base64"),
        mimeType: "audio/mpeg",
        fileName: "client-brief.mp3"
      })
    );
    expect(parser.parseLead).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining("Audio transcript 1 (client-brief.mp3):")
      })
    );
    expect(created[0]).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          rawInput: expect.stringContaining("Telegram attachment 1: audio (client-brief.mp3, source audio-document, saved attachment-audio-document-601)")
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
              text: "new lead"
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

  it("does not start a lead draft from the incomplete /new command", async () => {
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
            update_id: 121,
            message: {
              message_id: 71,
              date: 1779296500,
              chat: { id: 12345 },
              text: "/new"
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
    ).resolves.toEqual({ processed: 0, ignored: 1, lastUpdateId: 121 });

    await expect(telegramDraftStore.getActive({ workspaceId: "workspace-demo", chatId: "12345" })).resolves.toBeNull();
    expect(client.lead.create).not.toHaveBeenCalled();
    const sendCall = fetchMock.mock.calls[0] as unknown as [string, { body?: unknown }];
    expect(JSON.parse(String(sendCall[1]?.body)).text).toContain("Use new lead");
  });

  it("creates a fresh lead when the new lead command includes source material even if an old lead looks similar", async () => {
    const created: unknown[] = [];
    const client = {
      lead: {
        findMany: vi.fn(async (args: unknown) => {
          const where = (args as { where?: { OR?: unknown[] } }).where;
          if (where?.OR) {
            return [];
          }

          return [
            {
              id: "lead-record-2",
              leadId: "L-2026-002",
              status: "needs_data",
              rawInput: "Old Katya lead",
              requestType: "new_build",
              projectAddress: "Chiemseeufer 7",
              bgfM2: null,
              missingData: ["bgfM2"],
              client: { name: "Katya", email: "katya@example.com", phone: null }
            }
          ];
        }),
        create: vi.fn(async (args: unknown) => {
          created.push(args);
          return { id: "lead-record-3", leadId: "L-2026-003", status: "new" };
        }),
        update: vi.fn()
      }
    };
    const parser: OpenAiLeadParserClient = {
      parseLead: vi.fn(async () => ({
        clientName: "",
        requestType: "new_build",
        urgency: "medium" as const,
        temperature: "warm" as const,
        projectAddress: "Chiemseeufer 7",
        bgfM2: 180,
        email: "katya@example.com",
        phone: null,
        missingData: [],
        summary: "Fresh lead from explicit command",
        suggestedReply: "Created."
      }))
    };
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/sendMessage")) {
        return { ok: true, status: 200, json: async () => ({ ok: true, result: { message_id: 950 } }) };
      }

      throw new Error(`Unexpected URL ${url}`);
    });

    await expect(
      processTelegramUpdates(
        [
          {
            update_id: 13,
            message: {
              message_id: 77,
              date: 1779296510,
              chat: { id: 12345 },
              text: "new lead Katya, new build at Chiemseeufer 7, BGF 180, katya@example.com"
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
    ).resolves.toEqual({ processed: 1, ignored: 0, lastUpdateId: 13 });

    expect(client.lead.update).toHaveBeenCalledWith({
      where: { id: "lead-record-3" },
      data: { rawInput: expect.stringContaining("Telegram lead card: telegram-bot:12345:950") }
    });
    expect(created).toHaveLength(1);
    expect(created[0]).toEqual({
      data: expect.objectContaining({
        leadId: "L-2026-003",
        rawInput: expect.stringContaining("new lead Katya"),
        projectAddress: "Chiemseeufer 7",
        bgfM2: 180
      })
    });
    const sendCall = fetchMock.mock.calls.at(-1) as unknown as [string, { body?: unknown }];
    const sendBody = JSON.parse(String(sendCall[1]?.body));
    expect(sendBody.text).toContain("<b>L-2026-003</b> created in CRM.");
    expect(sendBody.reply_markup.inline_keyboard.flat()).toContainEqual({
      text: "Undo",
      callback_data: "lead_undo:L-2026-003:77"
    });
  });

  it("creates a CRM lead immediately for incomplete document intake and asks for KP fields", async () => {
    const created: unknown[] = [];
    const client = {
      lead: {
        findMany: vi.fn(async () => [{ leadId: "L-2026-001", rawInput: "old" }]),
        create: vi.fn(async (args: unknown) => {
          created.push(args);
          return { id: "lead-record-incomplete", leadId: "L-2026-002", status: "needs_data" };
        }),
        update: vi.fn()
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
          crmBaseUrl: "https://crm.example.com",
          parser,
          prisma: client,
          telegramDraftStore,
          fetchImpl: fetchMock as unknown as typeof fetch
        }
      )
    ).resolves.toEqual({ processed: 1, ignored: 0, lastUpdateId: 13 });

    await expect(telegramDraftStore.getActive({ workspaceId: "workspace-demo", chatId: "12345" })).resolves.toMatchObject({
      leadId: "L-2026-002",
      draft: {
        clientName: "Katya",
        requestType: "new_build",
        missingData: ["projectAddress", "bgfM2"]
      }
    });
    expect(created).toEqual([
      expect.objectContaining({
        data: expect.objectContaining({
          leadId: "L-2026-002",
          status: "needs_data",
          rawInput: expect.stringContaining("lead.pdf"),
          requestType: "new_build",
          missingData: ["projectAddress", "bgfM2"]
        })
      })
    ]);
    const sendCall = fetchMock.mock.calls.at(-1) as unknown as [string, { body?: unknown }];
    const sendBody = JSON.parse(String(sendCall[1]?.body));
    expect(sendBody.text).toContain("<b>L-2026-002</b> created in CRM.");
    expect(sendBody.text).toContain("L-2026-002");
    expect(sendBody.text).toContain("Missing for KP: <b>projectAddress, bgfM2</b>");
    expect(sendBody.reply_markup.inline_keyboard[0]).toContainEqual({ text: "CRM", url: "https://crm.example.com/leads?leadId=L-2026-002" });
    expect(sendBody.reply_markup.inline_keyboard[0]).toContainEqual({ text: "Undo", callback_data: "lead_undo:L-2026-002:8" });
  });

  it("clears a stale Telegram draft session and creates a new lead when the saved lead was deleted", async () => {
    const created: unknown[] = [];
    const client = {
      lead: {
        findMany: vi.fn(async () => []),
        create: vi.fn(async (args: unknown) => {
          created.push(args);
          return { id: "lead-record-new", leadId: "L-2026-001", status: "needs_data" };
        }),
        update: vi.fn(async () => {
          const error = new Error("An operation failed because it depends on one or more records that were required but not found. No record was found for an update.");
          Object.assign(error, { code: "P2025" });
          throw error;
        })
      }
    };
    const parser: OpenAiLeadParserClient = {
      parseLead: vi.fn(async () => ({
        clientName: "Fresh Client",
        requestType: "new_build",
        urgency: "medium" as const,
        temperature: "warm" as const,
        bgfM2: undefined,
        projectAddress: undefined,
        email: null,
        phone: null,
        missingData: ["projectAddress", "bgfM2"],
        summary: "Fresh lead after table reset.",
        suggestedReply: "Need address and BGF."
      }))
    };
    const telegramDraftStore = createMemoryTelegramLeadDraftSessionStore();
    await telegramDraftStore.save({
      chatId: "12345",
      workspaceId: "workspace-demo",
      startedAt: "2026-06-01T18:00:00.000Z",
      updatedAt: "2026-06-01T18:00:00.000Z",
      sourceMessageIds: [700],
      telegramDraftMessageId: 701,
      leadId: "L-2026-099",
      draft: {
        source: "telegram",
        clientName: "Deleted Client",
        email: null,
        phone: null,
        requestType: "new_build",
        projectAddress: null,
        bgfM2: null,
        rawInput: "Deleted lead draft",
        missingData: ["projectAddress"],
        isStandard: true,
        telegramSourceExternalId: "telegram:12345:700",
        temperature: "warm"
      }
    });
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
            update_id: 79,
            message: {
              message_id: 709,
              date: 1780254660,
              chat: { id: 12345 },
              text: "Fresh Client needs a new EFH offer."
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
          telegramDraftStore,
          fetchImpl: fetchMock as unknown as typeof fetch
        }
      )
    ).resolves.toEqual({ processed: 1, ignored: 0, lastUpdateId: 79 });

    expect(client.lead.update).toHaveBeenCalledOnce();
    expect(created).toEqual([
      expect.objectContaining({
        data: expect.objectContaining({
          leadId: "L-2026-001",
          status: "needs_data",
          rawInput: expect.stringContaining("Fresh lead after table reset.")
        })
      })
    ]);
    await expect(telegramDraftStore.getActive({ workspaceId: "workspace-demo", chatId: "12345" })).resolves.toMatchObject({
      leadId: "L-2026-001"
    });
    const sendCall = fetchMock.mock.calls.at(-1) as unknown as [string, { body?: unknown }];
    expect(JSON.parse(String(sendCall[1]?.body)).text).toContain("<b>L-2026-001</b> created in CRM.");
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
    const updates: unknown[] = [];
    const client = {
      lead: {
        findMany: vi.fn(async () => [{ leadId: "L-2026-001", rawInput: "old" }]),
        create: vi.fn(async (args: unknown) => {
          created.push(args);
          return { id: "lead-record-2", leadId: "L-2026-002", status: "needs_data" };
        }),
        update: vi.fn(async (args: unknown) => {
          updates.push(args);
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
          requestType: "new_build",
          status: "needs_data",
          missingData: ["projectAddress", "bgfM2"]
        })
      }
    ]);
    expect(updates).toEqual([
      expect.objectContaining({
        where: { workspaceId_leadId: { workspaceId: "workspace-demo", leadId: "L-2026-002" } },
        data: expect.objectContaining({
          projectAddress: "Chiemseeufer 7",
          bgfM2: 180,
          missingData: [],
          status: "new"
        })
      })
    ]);
    await expect(telegramDraftStore.getActive({ workspaceId: "workspace-demo", chatId: "12345" })).resolves.toBeNull();
    const sendCall = fetchMock.mock.calls.at(-1) as unknown as [string, { body?: unknown }];
    const sendBody = JSON.parse(String(sendCall[1]?.body));
    expect(sendBody.text).toContain("<b>L-2026-002</b> updated in CRM.");
    expect(sendBody.text).toContain("Project address: <b>Chiemseeufer 7</b>");
    expect(sendBody.text).not.toContain("mark KP sent");
    expect(sendBody.reply_markup.inline_keyboard[0][0].url).toBe("https://crm.example.com/leads?leadId=L-2026-002");
    expect(sendBody.reply_markup.inline_keyboard.flat()).toContainEqual({
      text: "Undo",
      callback_data: "lead_undo:L-2026-002:10"
    });
  });

  it("generates and links a KP document when Telegram lead fields are ready", async () => {
    const created: unknown[] = [];
    const updates: unknown[] = [];
    const generatedDocuments: unknown[] = [];
    const telegramDraftStore = createMemoryTelegramLeadDraftSessionStore();
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
          telegramDraftStore,
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
    expect(finalMessageBody.text).toContain("<b>L-2026-002</b> created in CRM.");
    expect(finalMessageBody.text).toContain("Pricing: <b>standard</b>");
    expect(finalMessageBody.text).not.toContain("<b>KP document</b>: D-telegram-12345-13");
    expect(finalMessageBody.reply_markup.inline_keyboard[0]).toContainEqual({ text: "CRM", url: "https://crm.example.com/leads?leadId=L-2026-002" });
    expect(finalMessageBody.reply_markup.inline_keyboard[0]).toContainEqual({
      text: "KP PDF",
      url: "https://crm.example.com/documents/attachments/attachment-pdf-1"
    });
    expect(finalMessageBody.reply_markup.inline_keyboard[0]).toContainEqual({ text: "KP DOC", url: "https://files.example.com/kp.docx" });
    expect(finalMessageBody.reply_markup.inline_keyboard[0]).toContainEqual({ text: "Undo", callback_data: "lead_undo:L-2026-002:13" });
    expect(finalMessageBody.reply_markup.inline_keyboard[0].map((button: { url?: string }) => button.url).filter(Boolean)).toSatisfy((urls: string[]) =>
      urls.every((url) => /^(?:https?:\/\/|mailto:)/.test(url))
    );
  });

  it("does not run KP sent actions from Telegram inline callbacks", async () => {
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
    expect(updates).toEqual([]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.telegram.org/bottelegram-token/answerCallbackQuery",
      expect.objectContaining({ method: "POST", body: expect.stringContaining("Use new lead") })
    );
  });

  it("persists Telegram channel events when a KP-ready lead is created", async () => {
    const auditEvents: unknown[] = [];
    const telegramDraftStore = createMemoryTelegramLeadDraftSessionStore();
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
        telegramDraftStore,
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

    expect(auditEvents.flatMap((event) => {
      const type = (event as { metadata: { type?: string } }).metadata.type;
      return type && !type.startsWith("telegram_lead_undo_") ? [type] : [];
    })).toEqual([
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
    const telegramDraftStore = createMemoryTelegramLeadDraftSessionStore();
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
        telegramDraftStore,
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
    const finalMessageText = JSON.parse(String(finalMessageCall[1].body)).text;
    expect(finalMessageText).toContain("Ready KP lead");
    expect(finalMessageText).not.toContain("Summary: <b>Ready KP lead</b>");
    expect(finalMessageText).not.toContain("<b>KP document</b>");
  });

  it("still confirms the lead when Telegram document delivery fails", async () => {
    const telegramDraftStore = createMemoryTelegramLeadDraftSessionStore();
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
          telegramDraftStore,
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
    expect(finalMessageBody.text).toContain("Ready KP lead");
    expect(finalMessageBody.text).not.toContain("Summary: <b>Ready KP lead</b>");
    expect(finalMessageBody.text).not.toContain("<b>KP document</b>");
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
    expect(finalMessageBody.text).not.toContain("Lead: <b>L-2026-002</b>");
    expect(finalMessageBody.text).toContain("KP generation: <b>lead created, but KP was not generated because the current KP template is missing");
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
      "KP generation: <b>lead created, but KP was not generated because PDF export is not configured or failed.</b>"
    );
  });

  it("treats a reply to the bot draft message as an explicit update to that draft", async () => {
    const created: unknown[] = [];
    const updates: unknown[] = [];
    const client = {
      lead: {
        findMany: vi.fn(async () => [{ leadId: "L-2026-001", rawInput: "old" }]),
        create: vi.fn(async (args: unknown) => {
          created.push(args);
          return { id: "lead-record-2", leadId: "L-2026-002", status: "needs_data" };
        }),
        update: vi.fn(async (args: unknown) => {
          updates.push(args);
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
          missingData: ["bgfM2"]
        })
      }
    ]);
    expect(updates.at(-1)).toEqual(
      expect.objectContaining({
        where: { workspaceId_leadId: { workspaceId: "workspace-demo", leadId: "L-2026-002" } },
        data: expect.objectContaining({
          projectAddress: "Chiemseeufer 7",
          bgfM2: 180,
          missingData: [],
          status: "new"
        })
      })
    );
  });

  it("adds an undo button to Telegram lead creation and removes the new lead when undo is clicked", async () => {
    const auditEvents: unknown[] = [];
    const deleted: unknown[] = [];
    const client = {
      leadContextEntity: {
        deleteMany: vi.fn(async (args: unknown) => ({ count: 2, args }))
      },
      crmCalendarAction: {
        deleteMany: vi.fn(async (args: unknown) => ({ count: 1, args }))
      },
      lead: {
        findMany: vi.fn(async (args: unknown) => {
          const leadId = (args as { where?: { leadId?: string } }).where?.leadId;
          if (leadId === "L-2026-002") {
            return [{ id: "lead-record-2", leadId: "L-2026-002", status: "new", rawInput: "Saved lead" }];
          }

          return [{ leadId: "L-2026-001", rawInput: "old" }];
        }),
        create: vi.fn(async () => ({ id: "lead-record-2", leadId: "L-2026-002", status: "new" })),
        update: vi.fn(async () => ({ id: "lead-record-2", leadId: "L-2026-002", status: "new" })),
        delete: vi.fn(async (args: unknown) => {
          deleted.push(args);
          return { id: "lead-record-2", leadId: "L-2026-002" };
        })
      }
    };
    const parser: OpenAiLeadParserClient = {
      parseLead: vi.fn(async () => ({
        clientName: "",
        requestType: "new_build",
        urgency: "medium" as const,
        temperature: "warm" as const,
        projectAddress: "Chiemseeufer 7",
        bgfM2: 180,
        email: "katya@example.com",
        phone: null,
        missingData: [],
        summary: "Ready lead",
        suggestedReply: "Ready."
      }))
    };
    let nextBotMessageId = 900;
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/sendMessage")) {
        return { ok: true, status: 200, json: async () => ({ ok: true, result: { message_id: nextBotMessageId++ } }) };
      }

      if (url.includes("/answerCallbackQuery")) {
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
      saveAuditEvent: async (event: unknown) => {
        auditEvents.push(event);
      },
      fetchImpl: fetchMock as unknown as typeof fetch
    };

    await processTelegramUpdates(
      [
        {
          update_id: 181,
          message: {
            message_id: 41,
            date: 1779297000,
            chat: { id: 12345 },
            text: "Katya, new build, Chiemseeufer 7, BGF 180, katya@example.com"
          }
        }
      ],
      config
    );

    const createCall = fetchMock.mock.calls.at(-1) as unknown as [string, { body?: unknown }];
    const createBody = JSON.parse(String(createCall[1].body));
    expect(createBody.reply_markup.inline_keyboard.flat()).toContainEqual({
      text: "Undo",
      callback_data: "lead_undo:L-2026-002:41"
    });

    await expect(
      processTelegramUpdates(
        [
          {
            update_id: 182,
            callback_query: {
              id: "callback-undo-create",
              data: "lead_undo:L-2026-002:41",
              message: { message_id: 900, date: 1779297010, chat: { id: 12345 } }
            }
          }
        ],
        config
      )
    ).resolves.toEqual({ processed: 1, ignored: 1, lastUpdateId: 182 });

    expect(client.leadContextEntity.deleteMany).toHaveBeenCalledWith({ where: { workspaceId: "workspace-demo", leadRecordId: "lead-record-2" } });
    expect(client.crmCalendarAction.deleteMany).toHaveBeenCalledWith({ where: { workspaceId: "workspace-demo", leadRecordId: "lead-record-2" } });
    expect(deleted).toEqual([{ where: { id: "lead-record-2" } }]);
    const undoCall = fetchMock.mock.calls.at(-1) as unknown as [string, { body?: unknown }];
    const undoBody = JSON.parse(String(undoCall[1].body));
    expect(undoBody.text).toContain("Undo done");
    expect(undoBody.text).toContain("L-2026-002");
  });

  it("asks for clarification when a Telegram user types a lead undo request without pressing the Undo button", async () => {
    const client = {
      lead: {
        findMany: vi.fn(async () => []),
        create: vi.fn(),
        update: vi.fn()
      }
    };
    const parser: OpenAiLeadParserClient = {
      parseLead: vi.fn()
    };
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/sendMessage")) {
        return { ok: true, status: 200, json: async () => ({ ok: true, result: { message_id: 901 } }) };
      }

      throw new Error(`Unexpected URL ${url}`);
    });

    await expect(
      processTelegramUpdates(
        [
          {
            update_id: 183,
            message: {
              message_id: 42,
              date: 1779297020,
              chat: { id: 12345 },
              text: "undo lead L-2026-002"
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
    ).resolves.toEqual({ processed: 0, ignored: 1, lastUpdateId: 183 });

    expect(parser.parseLead).not.toHaveBeenCalled();
    expect(client.lead.create).not.toHaveBeenCalled();
    expect(client.lead.update).not.toHaveBeenCalled();
    const replyCall = fetchMock.mock.calls.at(-1) as unknown as [string, { body?: unknown }];
    const replyBody = JSON.parse(String(replyCall[1].body));
    expect(replyBody.text).toContain("Undo");
    expect(replyBody.text).toContain("Create new lead from this source");
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
          crmBaseUrl: "https://crm.example.com",
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
    expect(sendBody.text).toContain("<b>L-2026-002</b> updated in CRM.");
    expect(sendBody.text).toContain("Summary: <b>BGF and email update</b>");
    expect(sendBody.text).toContain("Email: <b>katya@example.com</b>");
    expect(sendBody.text).not.toContain("Client: <b>unknown</b>");
    expect(sendBody.text).not.toContain("mark KP sent");
    expect(sendBody.reply_markup.inline_keyboard[0][0]).toEqual({
      text: "CRM",
      url: "https://crm.example.com/leads?leadId=L-2026-002"
    });
    expect(sendBody.reply_markup.inline_keyboard.flat()).toContainEqual({
      text: "Undo",
      callback_data: "lead_undo:L-2026-002:31"
    });
  });

  it("undoes the last Telegram lead update and offers to create a new lead from the same source", async () => {
    const auditEvents: unknown[] = [];
    const updates: unknown[] = [];
    const client = {
      lead: {
        findMany: vi.fn(async (args: unknown) => {
          const rawInput = (args as { where?: { rawInput?: { contains?: string } } }).where?.rawInput?.contains;
          const leadId = (args as { where?: { leadId?: string } }).where?.leadId;
          if (leadId === "L-2026-002") {
            return [
              {
                id: "lead-record-2",
                leadId: "L-2026-002",
                status: "new",
                rawInput: "Updated lead",
                requestType: "new_build",
                projectAddress: "Chiemseeufer 7",
                bgfM2: 180,
                missingData: []
              }
            ];
          }

          if (rawInput === "telegram-bot:12345:900") {
            return [
              {
                id: "lead-record-2",
                leadId: "L-2026-002",
                status: "needs_data",
                rawInput: "Initial lead\nTelegram lead card: telegram-bot:12345:900",
                requestType: "new_build",
                projectAddress: "Chiemseeufer 7",
                bgfM2: null,
                missingData: ["bgfM2"]
              }
            ];
          }

          return [];
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
        email: null,
        phone: null,
        missingData: [],
        summary: "BGF update",
        suggestedReply: "Updated."
      }))
    };
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/sendMessage")) {
        return { ok: true, status: 200, json: async () => ({ ok: true, result: { message_id: 901 } }) };
      }

      if (url.includes("/answerCallbackQuery")) {
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
      saveAuditEvent: async (event: unknown) => {
        auditEvents.push(event);
      },
      fetchImpl: fetchMock as unknown as typeof fetch
    };

    await processTelegramUpdates(
      [
        {
          update_id: 221,
          message: {
            message_id: 331,
            date: 1779297000,
            chat: { id: 12345 },
            reply_to_message: { message_id: 900 },
            text: "BGF 180"
          }
        }
      ],
      config
    );

    await expect(
      processTelegramUpdates(
        [
          {
            update_id: 222,
            callback_query: {
              id: "callback-undo-update",
              data: "lead_undo:L-2026-002:331",
              message: { message_id: 901, date: 1779297010, chat: { id: 12345 } }
            }
          }
        ],
        config
      )
    ).resolves.toEqual({ processed: 1, ignored: 1, lastUpdateId: 222 });

    expect(updates.at(-1)).toEqual({
      where: { id: "lead-record-2" },
      data: expect.objectContaining({
        status: "needs_data",
        rawInput: "Initial lead\nTelegram lead card: telegram-bot:12345:900",
        bgfM2: null,
        missingData: ["bgfM2"]
      })
    });
    const sendCall = fetchMock.mock.calls.at(-1) as unknown as [string, { body?: unknown }];
    const sendBody = JSON.parse(String(sendCall[1].body));
    expect(sendBody.text).toContain("Undo done");
    expect(sendBody.reply_markup.inline_keyboard.flat()).toContainEqual({
      text: "Create new lead from this source",
      callback_data: "lead_recreate:L-2026-002:331"
    });
  });

  it("creates a new lead from the same source after undoing a Telegram update", async () => {
    const created: unknown[] = [];
    const client = {
      lead: {
        findMany: vi.fn(async (args: unknown) => {
          const rawInput = (args as { where?: { rawInput?: { contains?: string } } }).where?.rawInput?.contains;
          const leadId = (args as { where?: { leadId?: string } }).where?.leadId;
          if (leadId === "L-2026-002") {
            return [
              {
                id: "lead-record-2",
                leadId: "L-2026-002",
                status: "new",
                rawInput: "Updated lead",
                requestType: "new_build",
                projectAddress: "Chiemseeufer 7",
                bgfM2: 180,
                missingData: []
              }
            ];
          }

          if (rawInput === "telegram-bot:12345:900") {
            return [
              {
                id: "lead-record-2",
                leadId: "L-2026-002",
                status: "needs_data",
                rawInput: "Initial lead\nTelegram lead card: telegram-bot:12345:900",
                requestType: "new_build",
                projectAddress: "Chiemseeufer 7",
                bgfM2: null,
                missingData: ["bgfM2"]
              }
            ];
          }

          return [{ leadId: "L-2026-001", rawInput: "old" }, { leadId: "L-2026-002", rawInput: "old 2" }];
        }),
        create: vi.fn(async (args: unknown) => {
          created.push(args);
          return { id: "lead-record-3", leadId: "L-2026-003", status: "new" };
        }),
        update: vi.fn(async () => ({ id: "lead-record-2", leadId: "L-2026-002", status: "new" }))
      }
    };
    const parser: OpenAiLeadParserClient = {
      parseLead: vi.fn(async () => ({
        clientName: "",
        requestType: "new_build",
        urgency: "medium" as const,
        temperature: "warm" as const,
        projectAddress: "Chiemseeufer 7",
        bgfM2: 180,
        email: "katya@example.com",
        phone: null,
        missingData: [],
        summary: "BGF update",
        suggestedReply: "Updated."
      }))
    };
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/sendMessage")) {
        return { ok: true, status: 200, json: async () => ({ ok: true, result: { message_id: 951 } }) };
      }

      if (url.includes("/answerCallbackQuery")) {
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
      fetchImpl: fetchMock as unknown as typeof fetch
    };

    await processTelegramUpdates(
      [
        {
          update_id: 223,
          message: {
            message_id: 332,
            date: 1779297000,
            chat: { id: 12345 },
            reply_to_message: { message_id: 900 },
            text: "Katya, BGF 180, katya@example.com"
          }
        }
      ],
      config
    );
    const updateCall = fetchMock.mock.calls.at(-1) as unknown as [string, { body?: unknown }];
    const updateBody = JSON.parse(String(updateCall[1].body));
    expect(updateBody.text).toContain("<b>L-2026-002</b> updated in CRM.");
    expect(updateBody.reply_markup.inline_keyboard.flat()).toContainEqual({
      text: "Undo",
      callback_data: "lead_undo:L-2026-002:332"
    });
    await processTelegramUpdates(
      [
        {
          update_id: 224,
          callback_query: {
            id: "callback-undo-update-recreate",
            data: "lead_undo:L-2026-002:332",
            message: { message_id: 951, date: 1779297010, chat: { id: 12345 } }
          }
        }
      ],
      config
    );
    const undoCall = fetchMock.mock.calls.at(-1) as unknown as [string, { body?: unknown }];
    const undoBody = JSON.parse(String(undoCall[1].body));
    expect(undoBody.text).toContain("Undo done");

    await expect(
      processTelegramUpdates(
        [
          {
            update_id: 225,
            callback_query: {
              id: "callback-recreate",
              data: "lead_recreate:L-2026-002:332",
              message: { message_id: 952, date: 1779297020, chat: { id: 12345 } }
            }
          }
        ],
        config
      )
    ).resolves.toEqual({ processed: 1, ignored: 1, lastUpdateId: 225 });

    const sendCall = fetchMock.mock.calls.at(-1) as unknown as [string, { body?: unknown }];
    const sendBody = JSON.parse(String(sendCall[1].body));
    expect(sendBody.text).toContain("<b>L-2026-003</b> created in CRM.");
    expect(created).toHaveLength(1);
    expect(created[0]).toEqual({
      data: expect.objectContaining({
        leadId: "L-2026-003",
        rawInput: expect.stringContaining("Katya, BGF 180"),
        projectAddress: "Chiemseeufer 7",
        bgfM2: 180
      })
    });
    expect(sendBody.reply_markup.inline_keyboard.flat()).toContainEqual({
      text: "Undo",
      callback_data: "lead_undo:L-2026-003:952"
    });
  });

  it("does not show unknown placeholder values in Telegram lead update cards", async () => {
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
                missingData: ["email"]
              }
            ];
          }

          return [];
        }),
        create: vi.fn(),
        update: vi.fn(async () => ({ id: "lead-record-2", leadId: "L-2026-002", status: "new" }))
      }
    };
    const parser: OpenAiLeadParserClient = {
      parseLead: vi.fn(async () => ({
        clientName: "unknown",
        requestType: "unknown",
        urgency: "medium" as const,
        temperature: "unknown" as const,
        projectAddress: undefined,
        bgfM2: undefined,
        email: "katya@example.com",
        phone: null,
        missingData: [],
        summary: "Email update",
        suggestedReply: "Updated."
      }))
    };
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/sendMessage")) {
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }

      throw new Error(`Unexpected URL ${url}`);
    });

    await processTelegramUpdates(
      [
        {
          update_id: 211,
          message: {
            message_id: 311,
            date: 1779297000,
            chat: { id: 12345 },
            reply_to_message: { message_id: 900 },
            text: "email katya@example.com"
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
    );

    const sendCall = fetchMock.mock.calls.at(-1) as unknown as [string, { body?: unknown }];
    const sendBody = JSON.parse(String(sendCall[1].body));
    expect(sendBody.text).toContain("<b>L-2026-002</b> updated in CRM.");
    expect(sendBody.text).toContain("Email: <b>katya@example.com</b>");
    expect(sendBody.text).not.toContain("Client: <b>unknown</b>");
    expect(sendBody.text).not.toContain("Request type: <b>unknown</b>");
  });

  it("runs CRM entity extraction after updating a Telegram lead by reply", async () => {
    const savedExtractions: unknown[] = [];
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
                missingData: ["email"],
                requestType: "renovation",
                projectAddress: "Sochi"
              }
            ];
          }

          return [];
        }),
        create: vi.fn(),
        update: vi.fn(async () => ({ id: "lead-record-2", leadId: "L-2026-002", status: "new" }))
      }
    };
    const parser: OpenAiLeadParserClient = {
      parseLead: vi.fn(async () => ({
        clientName: "",
        requestType: "",
        urgency: "medium" as const,
        temperature: "warm" as const,
        projectAddress: undefined,
        bgfM2: undefined,
        email: "artem@example.com",
        phone: null,
        missingData: [],
        summary: "Email and context update",
        suggestedReply: "Updated."
      }))
    };
    const crmEntityExtractor = {
      extract: vi.fn(async () => ({
        facts: [{ type: "FACT" as const, label: "Preference", value: "Likes jazz", sourceText: "likes jazz", confidence: "high" as const }],
        events: [],
        followups: [],
        people: [],
        organizations: [],
        tags: [],
        leadNaming: { displayName: null, projectPlace: null, language: "en", country: null },
        confidence: { overall: "high" as const },
        summary: "Found one new client preference."
      }))
    };
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/sendMessage")) {
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }

      throw new Error(`Unexpected URL ${url}`);
    });

    await processTelegramUpdates(
      [
        {
          update_id: 212,
          message: {
            message_id: 312,
            date: 1779297000,
            chat: { id: 12345 },
            reply_to_message: { message_id: 900 },
            text: "email artem@example.com and remember that he likes jazz"
          }
        }
      ],
      {
        allowedChatIds: new Set(["12345"]),
        botToken: "telegram-token",
        workspaceId: "workspace-demo",
        parser,
        prisma: client,
        crmEntityExtractor,
        saveLeadEntityExtraction: async (input) => {
          savedExtractions.push(input);
        },
        fetchImpl: fetchMock as unknown as typeof fetch
      }
    );

    expect(client.lead.create).not.toHaveBeenCalled();
    expect(crmEntityExtractor.extract).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-demo",
        leadId: "L-2026-002",
        messageId: "telegram:12345:312",
        text: expect.stringContaining("artem@example.com")
      })
    );
    expect(savedExtractions).toEqual([
      expect.objectContaining({
        workspaceId: "workspace-demo",
        leadRecordId: "lead-record-2",
        leadId: "L-2026-002",
        sourceChannel: "telegram",
        sourceMessageId: "telegram:12345:312",
        actorUserId: "telegram:12345",
        entities: [expect.objectContaining({ type: "FACT", label: "Preference", value: "Likes jazz" })],
        summary: expect.stringContaining("Found one new client preference")
      })
    ]);
  });

  it("updates an existing lead when replying to a lead card text that contains the lead id", async () => {
    const updates: unknown[] = [];
    const findManyCalls: unknown[] = [];
    const client = {
      lead: {
        findMany: vi.fn(async (args: unknown) => {
          findManyCalls.push(args);
          const where = (args as { where?: { rawInput?: { contains?: string }; leadId?: string } }).where;
          if (where?.leadId === "L-2026-048") {
            return [
              {
                id: "lead-record-48",
                leadId: "L-2026-048",
                status: "needs_data",
                rawInput: "Initial lead",
                client: { name: "Katya", email: null, phone: null },
                requestType: "bungalow planning",
                projectAddress: "St.-Georg-Straße 17",
                bgfM2: 86.4,
                missingData: ["email"]
              }
            ];
          }

          return [];
        }),
        create: vi.fn(),
        update: vi.fn(async (args: unknown) => {
          updates.push(args);
          return { id: "lead-record-48", leadId: "L-2026-048", status: "new" };
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
        bgfM2: undefined,
        email: "katya@example.com",
        phone: null,
        missingData: [],
        summary: "Email update",
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
            update_id: 210,
            message: {
              message_id: 310,
              date: 1779297000,
              chat: { id: 12345 },
              reply_to_message: {
                message_id: 900,
                text: "L-2026-048 created in CRM.\nPricing: not standard - missing email."
              },
              text: "email katya@example.com"
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
    ).resolves.toEqual({ processed: 1, ignored: 0, lastUpdateId: 210 });

    expect(client.lead.create).not.toHaveBeenCalled();
    expect(findManyCalls).toEqual(expect.arrayContaining([expect.objectContaining({ where: expect.objectContaining({ leadId: "L-2026-048" }) })]));
    expect(updates[0]).toEqual(
      expect.objectContaining({
        where: { id: "lead-record-48" },
        data: expect.objectContaining({
          rawInput: expect.stringContaining("telegram lead update"),
          missingData: [],
          status: "new"
        })
      })
    );
  });

  it("updates an existing lead from an explicit Telegram update command with a lead id", async () => {
    const updates: unknown[] = [];
    const client = {
      lead: {
        findMany: vi.fn(async (args: unknown) => {
          const where = (args as { where?: { leadId?: string } }).where;
          if (where?.leadId === "L-2026-048") {
            return [
              {
                id: "lead-record-48",
                leadId: "L-2026-048",
                status: "needs_data",
                rawInput: "Initial lead",
                requestType: "bungalow planning",
                projectAddress: "St.-Georg-StraГџe 17",
                bgfM2: 86.4,
                missingData: ["email"]
              }
            ];
          }

          return [];
        }),
        create: vi.fn(),
        update: vi.fn(async (args: unknown) => {
          updates.push(args);
          return { id: "lead-record-48", leadId: "L-2026-048", status: "new" };
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
        bgfM2: undefined,
        email: "katya@example.com",
        phone: null,
        missingData: [],
        summary: "Email update from explicit command",
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
            update_id: 211,
            message: {
              message_id: 311,
              date: 1779297000,
              chat: { id: 12345 },
              text: "/update L-2026-048 email katya@example.com"
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
    ).resolves.toEqual({ processed: 1, ignored: 0, lastUpdateId: 211 });

    expect(client.lead.create).not.toHaveBeenCalled();
    expect(updates[0]).toEqual(
      expect.objectContaining({
        where: { id: "lead-record-48" },
        data: expect.objectContaining({
          rawInput: expect.stringContaining("/update L-2026-048"),
          missingData: ["clientName"]
        })
      })
    );
    const sendCall = fetchMock.mock.calls.at(-1) as unknown as [string, { body?: unknown }];
    const sendBody = JSON.parse(String(sendCall[1].body));
    expect(sendBody.text).toContain("<b>L-2026-048</b> updated in CRM.");
    expect(sendBody.reply_markup.inline_keyboard.flat()).toContainEqual({
      text: "Undo",
      callback_data: "lead_undo:L-2026-048:311"
    });
  });

  it("persists a Telegram interaction note when replying to a lead card with a human note", async () => {
    const auditEvents: unknown[] = [];
    const client = {
      lead: {
        findMany: vi.fn(async (args: unknown) => {
          const where = (args as { where?: { rawInput?: { contains?: string } } }).where;
          if (where?.rawInput?.contains === "telegram-bot:12345:900") {
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
        update: vi.fn(async () => ({ id: "lead-record-2", leadId: "L-2026-002", status: "new" }))
      }
    };
    const parser: OpenAiLeadParserClient = {
      parseLead: vi.fn(async () => ({
        clientName: "",
        requestType: "",
        urgency: "medium" as const,
        temperature: "warm" as const,
        projectAddress: undefined,
        email: null,
        phone: null,
        missingData: [],
        summary: "Sent the client a birthday gift",
        suggestedReply: "Saved."
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
            update_id: 41,
            message: {
              message_id: 901,
              date: 1779297400,
              chat: { id: 12345 },
              reply_to_message: { message_id: 900 },
              text: "Запиши: клиенту отправили подарок на день рождения"
            }
          }
        ],
        {
          allowedChatIds: new Set(["12345"]),
          botToken: "telegram-token",
          workspaceId: "workspace-demo",
          parser,
          prisma: client,
          saveAuditEvent: async (event) => {
            auditEvents.push(event);
          },
          fetchImpl: fetchMock as unknown as typeof fetch
        }
      )
    ).resolves.toEqual({ processed: 1, ignored: 0, lastUpdateId: 41 });

    expect(parser.parseLead).not.toHaveBeenCalled();
    expect(auditEvents).toContainEqual(
      expect.objectContaining({
        action: "assistant.channel.event",
        metadata: expect.objectContaining({
          type: "lead_interaction_note",
          channel: "telegram",
          leadId: "L-2026-002",
          messageId: "901",
          summary: expect.stringContaining("подарок")
        })
      })
    );
    const sendCall = fetchMock.mock.calls.at(-1) as unknown as [string, { body?: unknown }];
    const sendBody = JSON.parse(String(sendCall[1].body));
    expect(sendBody.text).toContain("<b>L-2026-002</b> updated in CRM.");
    expect(sendBody.text).toContain("History note: <b>");
    expect(sendBody.text).not.toContain("Saved this note");
  });

  it("records an explicit replied lead note without parsing it as a lead update", async () => {
    const auditEvents: unknown[] = [];
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
            update_id: 42,
            message: {
              message_id: 902,
              date: 1779297400,
              chat: { id: 12345 },
              reply_to_message: { message_id: 900 },
              text: "Record that we sent the client a birthday gift."
            }
          }
        ],
        {
          allowedChatIds: new Set(["12345"]),
          botToken: "telegram-token",
          workspaceId: "workspace-demo",
          parser,
          prisma: client,
          saveAuditEvent: async (event) => {
            auditEvents.push(event);
          },
          fetchImpl: fetchMock as unknown as typeof fetch
        }
      )
    ).resolves.toEqual({ processed: 1, ignored: 0, lastUpdateId: 42 });

    expect(parser.parseLead).not.toHaveBeenCalled();
    expect(client.lead.update).not.toHaveBeenCalled();
    expect(auditEvents).toContainEqual(
      expect.objectContaining({
        action: "assistant.channel.event",
        metadata: expect.objectContaining({
          type: "lead_interaction_note",
          channel: "telegram",
          leadId: "L-2026-002",
          messageId: "902",
          summary: "we sent the client a birthday gift."
        })
      })
    );
    const sendCall = fetchMock.mock.calls.at(-1) as unknown as [string, { body?: unknown }];
    const sendBody = JSON.parse(String(sendCall[1].body));
    expect(sendBody.text).toContain("<b>L-2026-002</b> updated in CRM.");
    expect(sendBody.text).toContain("History note: <b>we sent the client a birthday gift.</b>");
    expect(sendBody.text).not.toContain("Saved this note");
  });

  it("records a replied make-a-note command as lead history and returns a CRM button", async () => {
    const auditEvents: unknown[] = [];
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
            update_id: 43,
            message: {
              message_id: 903,
              date: 1779297400,
              chat: { id: 12345 },
              reply_to_message: { message_id: 900 },
              text: "Сделай пометку, что сегодня встречался с этим человеком за кофе. Оказался очень приятный дядька, который любит джаз."
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
          saveAuditEvent: async (event) => {
            auditEvents.push(event);
          },
          fetchImpl: fetchMock as unknown as typeof fetch
        }
      )
    ).resolves.toEqual({ processed: 1, ignored: 0, lastUpdateId: 43 });

    expect(parser.parseLead).not.toHaveBeenCalled();
    expect(client.lead.update).not.toHaveBeenCalled();
    expect(auditEvents).toContainEqual(
      expect.objectContaining({
        action: "assistant.channel.event",
        metadata: expect.objectContaining({
          type: "lead_interaction_note",
          channel: "telegram",
          leadId: "L-2026-002",
          messageId: "903",
          summary: "сегодня встречался с этим человеком за кофе. Оказался очень приятный дядька, который любит джаз."
        })
      })
    );
    const sendCall = fetchMock.mock.calls.at(-1) as unknown as [string, { body?: unknown }];
    const sendBody = JSON.parse(String(sendCall[1].body));
    expect(sendBody.text).toContain("<b>L-2026-002</b> updated in CRM.");
    expect(sendBody.text).toContain("History note: <b>");
    expect(sendBody.text).not.toContain("Saved this note");
    expect(sendBody.reply_markup.inline_keyboard[0][0]).toEqual({
      text: "CRM",
      url: "https://crm.example.com/leads?leadId=L-2026-002"
    });
  });

  it("records a replied reminder as a CRM follow-up and history without creating a gift reminder lead", async () => {
    const auditEvents: unknown[] = [];
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
        update: vi.fn(async () => ({ id: "lead-record-2", leadId: "L-2026-002", status: "new" }))
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
            update_id: 44,
            message: {
              message_id: 904,
              date: 1779297400,
              chat: { id: 12345 },
              reply_to_message: { message_id: 900 },
              text: "Напомни завтра посмотреть LinkedIn у него"
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
          saveAuditEvent: async (event) => {
            auditEvents.push(event);
          },
          fetchImpl: fetchMock as unknown as typeof fetch
        }
      )
    ).resolves.toEqual({ processed: 1, ignored: 0, lastUpdateId: 44 });

    expect(parser.parseLead).not.toHaveBeenCalled();
    expect(client.lead.create).not.toHaveBeenCalled();
    expect(client.lead.update).toHaveBeenCalledWith({
      where: { id: "lead-record-2" },
      data: {
        followup1Date: new Date("2026-05-21T09:00:00.000Z"),
        followupStatus: "planned"
      }
    });
    expect(auditEvents).toContainEqual(
      expect.objectContaining({
        action: "assistant.channel.event",
        metadata: expect.objectContaining({
          type: "lead_interaction_note",
          channel: "telegram",
          leadId: "L-2026-002",
          messageId: "904",
          summary: "Reminder scheduled: посмотреть LinkedIn у него. Due: 2026-05-21 09:00."
        })
      })
    );
    const sendCall = fetchMock.mock.calls.at(-1) as unknown as [string, { body?: unknown }];
    const sendBody = JSON.parse(String(sendCall[1].body));
    expect(sendBody.text).toContain("<b>L-2026-002</b> updated in CRM.");
    expect(sendBody.text).toContain("Reminder scheduled");
    expect(sendBody.text).toContain("2026-05-21 09:00");
    expect(sendBody.text).toContain("Google Calendar sync is not connected yet");
    expect(sendBody.text).not.toContain("Saved this reminder");
    expect(sendBody.reply_markup.inline_keyboard[0][0]).toEqual({
      text: "CRM",
      url: "https://crm.example.com/leads?leadId=L-2026-002"
    });
  });

  it("records a real Russian replied reminder as a CRM follow-up and history", async () => {
    const auditEvents: unknown[] = [];
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
        update: vi.fn(async () => ({ id: "lead-record-2", leadId: "L-2026-002", status: "new" }))
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
            update_id: 441,
            message: {
              message_id: 914,
              date: 1779297400,
              chat: { id: 12345 },
              reply_to_message: { message_id: 900 },
              text: "\u041d\u0430\u043f\u043e\u043c\u043d\u0438 \u0437\u0430\u0432\u0442\u0440\u0430 \u043f\u043e\u0441\u043c\u043e\u0442\u0440\u0435\u0442\u044c LinkedIn \u0443 \u043d\u0435\u0433\u043e"
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
          saveAuditEvent: async (event) => {
            auditEvents.push(event);
          },
          fetchImpl: fetchMock as unknown as typeof fetch
        }
      )
    ).resolves.toEqual({ processed: 1, ignored: 0, lastUpdateId: 441 });

    expect(parser.parseLead).not.toHaveBeenCalled();
    expect(client.lead.create).not.toHaveBeenCalled();
    expect(client.lead.update).toHaveBeenCalledWith({
      where: { id: "lead-record-2" },
      data: {
        followup1Date: new Date("2026-05-21T09:00:00.000Z"),
        followupStatus: "planned"
      }
    });
    expect(auditEvents).toContainEqual(
      expect.objectContaining({
        action: "assistant.channel.event",
        metadata: expect.objectContaining({
          type: "lead_interaction_note",
          channel: "telegram",
          leadId: "L-2026-002",
          messageId: "914",
          summary:
            "Reminder scheduled: \u043f\u043e\u0441\u043c\u043e\u0442\u0440\u0435\u0442\u044c LinkedIn \u0443 \u043d\u0435\u0433\u043e. Due: 2026-05-21 09:00."
        })
      })
    );
    const sendCall = fetchMock.mock.calls.at(-1) as unknown as [string, { body?: unknown }];
    const sendBody = JSON.parse(String(sendCall[1].body));
    expect(sendBody.text).toContain("<b>L-2026-002</b> updated in CRM.");
    expect(sendBody.text).toContain("Reminder scheduled");
    expect(sendBody.reply_markup.inline_keyboard[0][0]).toEqual({
      text: "CRM",
      url: "https://crm.example.com/leads?leadId=L-2026-002"
    });
  });

  it("does not record an explicit lead-id reminder until the user replies to a lead card", async () => {
    const auditEvents: unknown[] = [];
    const client = {
      lead: {
        findMany: vi.fn(async (args: unknown) => {
          const where = (args as { where?: { leadId?: string } }).where;
          if (where?.leadId === "L-2026-002") {
            return [
              {
                id: "lead-record-2",
                leadId: "L-2026-002",
                status: "new",
                rawInput: "Existing lead",
                missingData: []
              }
            ];
          }

          return [];
        }),
        create: vi.fn(),
        update: vi.fn(async () => ({ id: "lead-record-2", leadId: "L-2026-002", status: "new" }))
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
            update_id: 45,
            message: {
              message_id: 905,
              date: 1779297400,
              chat: { id: 12345 },
              text: "Напомни завтра позвонить лиду L-2026-002"
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
          saveAuditEvent: async (event) => {
            auditEvents.push(event);
          },
          fetchImpl: fetchMock as unknown as typeof fetch
        }
      )
    ).resolves.toEqual({ processed: 0, ignored: 1, lastUpdateId: 45 });

    expect(parser.parseLead).not.toHaveBeenCalled();
    expect(client.lead.create).not.toHaveBeenCalled();
    expect(client.lead.update).not.toHaveBeenCalled();
    expect(auditEvents).not.toContainEqual(expect.objectContaining({ metadata: expect.objectContaining({ type: "lead_interaction_note" }) }));
    const sendCall = fetchMock.mock.calls.at(-1) as unknown as [string, { body?: unknown }];
    const sendBody = JSON.parse(String(sendCall[1].body));
    expect(sendBody.text).toContain("<b>L-2026-002</b>");
    expect(sendBody.text).toContain("Reply to this lead card");
    expect(sendBody.reply_markup.inline_keyboard[0][0]).toEqual({
      text: "CRM",
      url: "https://crm.example.com/leads?leadId=L-2026-002"
    });
  });

  it("does not record an explicit lead-id note until the user replies to a lead card", async () => {
    const auditEvents: unknown[] = [];
    const client = {
      lead: {
        findMany: vi.fn(async (args: unknown) => {
          const where = (args as { where?: { leadId?: string } }).where;
          if (where?.leadId === "L-2026-002") {
            return [
              {
                id: "lead-record-2",
                leadId: "L-2026-002",
                status: "new",
                rawInput: "Existing lead",
                missingData: []
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
            update_id: 47,
            message: {
              message_id: 907,
              date: 1779297400,
              chat: { id: 12345 },
              text: "Запомни про лида L-2026-002: вчера встретились за кофе, клиент любит джаз."
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
          saveAuditEvent: async (event) => {
            auditEvents.push(event);
          },
          fetchImpl: fetchMock as unknown as typeof fetch
        }
      )
    ).resolves.toEqual({ processed: 0, ignored: 1, lastUpdateId: 47 });

    expect(parser.parseLead).not.toHaveBeenCalled();
    expect(client.lead.create).not.toHaveBeenCalled();
    expect(client.lead.update).not.toHaveBeenCalled();
    expect(auditEvents).not.toContainEqual(expect.objectContaining({ metadata: expect.objectContaining({ type: "lead_interaction_note" }) }));
    const sendCall = fetchMock.mock.calls.at(-1) as unknown as [string, { body?: unknown }];
    const sendBody = JSON.parse(String(sendCall[1].body));
    expect(sendBody.text).toContain("<b>L-2026-002</b>");
    expect(sendBody.text).toContain("Reply to this lead card");
    expect(sendBody.reply_markup.inline_keyboard[0][0]).toEqual({
      text: "CRM",
      url: "https://crm.example.com/leads?leadId=L-2026-002"
    });
  });

  it("does not advertise standalone reminder actions in Telegram without a lead reply", async () => {
    const client = {
      lead: {
        findMany: vi.fn(),
        create: vi.fn()
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
            update_id: 46,
            message: {
              message_id: 906,
              date: 1779297400,
              chat: { id: 12345 },
              text: "Напомни завтра посмотреть LinkedIn у него"
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
    ).resolves.toEqual({ processed: 0, ignored: 1, lastUpdateId: 46 });

    expect(parser.parseLead).not.toHaveBeenCalled();
    expect(client.lead.create).not.toHaveBeenCalled();
    const sendCall = fetchMock.mock.calls.at(-1) as unknown as [string, { body?: unknown }];
    const sendBody = JSON.parse(String(sendCall[1].body));
    expect(sendBody.text).toContain("Use new lead");
    expect(sendBody.text).toContain("search lead");
    expect(sendBody.text).toContain("reply to that card");
    expect(sendBody.text).not.toContain("I can create a follow-up reminder");
  });

  it("records natural replied client context as lead history without parsing a new lead", async () => {
    const auditEvents: unknown[] = [];
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
            update_id: 45,
            message: {
              message_id: 905,
              date: 1779297400,
              chat: { id: 12345 },
              reply_to_message: { message_id: 900 },
              text: "\u0412\u0447\u0435\u0440\u0430 \u0432\u0438\u0434\u0435\u043b\u0438 \u0435\u0433\u043e \u043d\u0430 \u0432\u044b\u0441\u0442\u0430\u0432\u043a\u0435, \u043e\u043d \u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0435\u0442\u0441\u044f \u043b\u044e\u0431\u0438\u0442 \u0434\u0436\u0430\u0437."
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
          saveAuditEvent: async (event) => {
            auditEvents.push(event);
          },
          fetchImpl: fetchMock as unknown as typeof fetch
        }
      )
    ).resolves.toEqual({ processed: 1, ignored: 0, lastUpdateId: 45 });

    expect(parser.parseLead).not.toHaveBeenCalled();
    expect(client.lead.create).not.toHaveBeenCalled();
    expect(client.lead.update).not.toHaveBeenCalled();
    expect(auditEvents).toContainEqual(
      expect.objectContaining({
        action: "assistant.channel.event",
        metadata: expect.objectContaining({
          type: "lead_interaction_note",
          channel: "telegram",
          leadId: "L-2026-002",
          messageId: "905",
          summary:
            "Client context: \u0412\u0447\u0435\u0440\u0430 \u0432\u0438\u0434\u0435\u043b\u0438 \u0435\u0433\u043e \u043d\u0430 \u0432\u044b\u0441\u0442\u0430\u0432\u043a\u0435, \u043e\u043d \u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0435\u0442\u0441\u044f \u043b\u044e\u0431\u0438\u0442 \u0434\u0436\u0430\u0437."
        })
      })
    );
    const sendCall = fetchMock.mock.calls.at(-1) as unknown as [string, { body?: unknown }];
    const sendBody = JSON.parse(String(sendCall[1].body));
    expect(sendBody.text).toContain("<b>L-2026-002</b> updated in CRM.");
    expect(sendBody.text).toContain("History note: <b>Client context:");
    expect(sendBody.text).not.toContain("Saved this client context");
    expect(sendBody.reply_markup.inline_keyboard[0][0]).toEqual({
      text: "CRM",
      url: "https://crm.example.com/leads?leadId=L-2026-002"
    });
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

  it("does not run KP sent actions from replies to the bot lead card", async () => {
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
    expect(updates).toEqual([]);
    const lastBody = JSON.parse(String((fetchMock.mock.calls.at(-1) as unknown as [string, { body?: unknown }])[1].body));
    expect(lastBody.text).toContain("Use new lead");
    expect(lastBody.text).toContain("search lead");
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
    expect(body.text).toContain("Use new lead");
    expect(body.text).toContain("search lead");
    expect(body.text).toContain("Find project Schneider EFH");
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
    expect(body.text).toContain("Use new lead");
    expect(body.text).toContain("search lead");
    expect(body.text).toContain("Show last 10 leads");
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
    expect(body.text).toContain("Use new lead");
    expect(body.text).toContain("search lead");
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
          fetchImpl: fetchMock as unknown as typeof fetch
        }
      )
    ).resolves.toEqual({ processed: 0, ignored: 1, lastUpdateId: 10 });

    expect(parser.parseLead).not.toHaveBeenCalled();
    expect(client.lead.create).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.telegram.org/bottelegram-token/sendMessage",
      expect.objectContaining({ method: "POST", body: expect.stringContaining("already exists") })
    );
  });

  it("answers Telegram when lead parsing fails instead of crashing the worker loop", async () => {
    const client = {
      lead: {
        findMany: vi.fn(async () => [{ leadId: "L-2026-001", rawInput: "old" }]),
        create: vi.fn()
      }
    };
    const parser: OpenAiLeadParserClient = {
      parseLead: vi.fn(async () => {
        throw new Error("OpenAI request failed: 400 Bad Request");
      })
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
            update_id: 77,
            message: {
              message_id: 707,
              date: 1780254616,
              chat: { id: 12345 },
              text: "Text plus attachments"
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
    ).resolves.toEqual({ processed: 0, ignored: 1, lastUpdateId: 77 });

    expect(client.lead.create).not.toHaveBeenCalled();
    const sendCall = fetchMock.mock.calls.at(-1) as unknown as [string, { body?: unknown }];
    expect(JSON.parse(String(sendCall[1]?.body)).text).toContain("I could not parse this lead yet");
  });

  it("answers Telegram with a generic server error when a lead is created but processing fails before confirmation", async () => {
    const client = {
      lead: {
        findMany: vi.fn(async () => [{ leadId: "L-2026-001", rawInput: "old" }]),
        create: vi.fn(async () => ({ id: "lead-record-2", leadId: "L-2026-002", status: "new" }))
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
    const telegramDraftStore = {
      getActive: vi.fn(async () => null),
      getByTelegramMessage: vi.fn(async () => null),
      save: vi.fn(async () => undefined),
      clear: vi.fn(async () => {
        throw new Error("Database connection lost while clearing Telegram draft.");
      })
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
            update_id: 78,
            message: {
              message_id: 708,
              date: 1780254616,
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
          telegramDraftStore,
          fetchImpl: fetchMock as unknown as typeof fetch
        }
      )
    ).resolves.toEqual({ processed: 0, ignored: 1, lastUpdateId: 78 });

    expect(client.lead.create).toHaveBeenCalledOnce();
    const sendCall = fetchMock.mock.calls.at(-1) as unknown as [string, { body?: unknown }];
    const sendBody = JSON.parse(String(sendCall[1]?.body));
    expect(sendBody.text).toBe("Server error occurred. Please try again later.");
    expect(sendBody.text).not.toContain("Database connection lost");
  });

  it("sends an early processing acknowledgement for batched Telegram files", async () => {
    const client = {
      lead: {
        findMany: vi.fn(async () => []),
        create: vi.fn(async () => ({ id: "lead-record-heavy", leadId: "L-2026-001", status: "new" }))
      }
    };
    const telegramDraftStore = createMemoryTelegramLeadDraftSessionStore();
    const parser: OpenAiLeadParserClient = {
      parseLead: vi.fn(async () => ({
        clientName: "Fam. Audio",
        requestType: "new_build",
        urgency: "high" as const,
        temperature: "warm" as const,
        bgfM2: 180,
        projectAddress: "Chiemseeufer 7",
        email: "audio@example.com",
        phone: "+49 170 123456",
        missingData: [],
        summary: "PDF and audio describe a house project.",
        suggestedReply: "Danke."
      }))
    };
    const audioTranscriber = {
      transcribe: vi.fn(async () => ({ text: "Client asks for a new build proposal." }))
    };
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/sendMessage")) {
        return { ok: true, status: 200, json: async () => ({ ok: true, result: { message_id: 900 } }) };
      }
      if (url.includes("/getFile") && url.includes("pdf-file")) {
        return { ok: true, status: 200, json: async () => ({ ok: true, result: { file_path: "documents/brief.pdf" } }) };
      }
      if (url.includes("/getFile") && url.includes("voice-file")) {
        return { ok: true, status: 200, json: async () => ({ ok: true, result: { file_path: "voice/brief.ogg" } }) };
      }
      if (url.includes("/file/")) {
        return { ok: true, status: 200, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer };
      }

      throw new Error(`Unexpected URL ${url}`);
    });

    await expect(
      processTelegramUpdates(
        [
          {
            update_id: 81,
            message: {
              message_id: 801,
              date: 1780254616,
              chat: { id: 12345 },
              document: { file_id: "pdf-file", file_name: "brief.pdf", mime_type: "application/pdf" }
            }
          },
          {
            update_id: 82,
            message: {
              message_id: 802,
              date: 1780254617,
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
          telegramDraftStore,
          batchWindowMs: 30_000,
          audioTranscriber,
          fetchImpl: fetchMock as unknown as typeof fetch
        }
      )
    ).resolves.toEqual({ processed: 1, ignored: 0, lastUpdateId: 82 });

    const sendMessageCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes("/sendMessage")) as unknown as Array<
      [string, { body?: unknown }]
    >;
    const sendBodies = sendMessageCalls.map(([, init]) => JSON.parse(String(init.body)));
    expect(sendBodies[0].text).toContain("I received several files");
    expect(sendBodies[0].text).toContain("This can take a little time");
    expect(sendBodies.at(-1).text).toContain("<b>L-2026-001</b> created in CRM.");
  });

  it("sends a server error after the early processing acknowledgement when heavy intake fails", async () => {
    const client = {
      lead: {
        findMany: vi.fn(async () => []),
        create: vi.fn()
      }
    };
    const parser: OpenAiLeadParserClient = {
      parseLead: vi.fn(async () => {
        throw new Error("OpenAI timeout");
      })
    };
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/sendMessage")) {
        return { ok: true, status: 200, json: async () => ({ ok: true, result: { message_id: 901 } }) };
      }
      if (url.includes("/getFile")) {
        return { ok: true, status: 200, json: async () => ({ ok: true, result: { file_path: "documents/brief.pdf" } }) };
      }
      if (url.includes("/file/")) {
        return { ok: true, status: 200, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer };
      }

      throw new Error(`Unexpected URL ${url}`);
    });

    await expect(
      processTelegramUpdates(
        [
          {
            update_id: 83,
            message: {
              message_id: 803,
              date: 1780254616,
              chat: { id: 12345 },
              document: { file_id: "pdf-file", file_name: "brief.pdf", mime_type: "application/pdf" }
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
    ).resolves.toEqual({ processed: 0, ignored: 1, lastUpdateId: 83 });

    const sendMessageCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes("/sendMessage")) as unknown as Array<
      [string, { body?: unknown }]
    >;
    const sendBodies = sendMessageCalls.map(([, init]) => JSON.parse(String(init.body)));
    expect(sendBodies[0].text).toContain("I received your file");
    expect(sendBodies.at(-1).text).toBe("Server error occurred while processing your materials. Please try again later.");
    expect(sendBodies.at(-1).text).not.toContain("OpenAI timeout");
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
