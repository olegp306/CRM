import { describe, expect, it } from "vitest";
import { runCrmLangGraphOrchestrator } from "./crm-langgraph-orchestrator";
import type { CrmOrchestratorClient } from "./openai-crm-orchestrator";

describe("crm langgraph orchestrator", () => {
  it("routes Telegram source material to lead creation", async () => {
    const result = await runCrmLangGraphOrchestrator({
      workspaceId: "workspace-demo",
      channel: "telegram",
      chatId: "410",
      messageId: "10",
      text: "new lead: Irina Schneider wants an EFH proposal, BGF 195 m2, Bad Aibling, irina@example.com",
      receivedAt: "2026-06-05T10:00:00.000Z"
    });

    expect(result.runtime).toBe("langgraph");
    expect(result.action).toEqual({
      type: "create_lead",
      reason: expect.stringContaining("new lead")
    });
  });

  it("routes Russian Telegram source material to lead creation", async () => {
    const result = await runCrmLangGraphOrchestrator({
      workspaceId: "workspace-demo",
      channel: "telegram",
      chatId: "410",
      messageId: "10",
      text:
        "\u0421\u043b\u0435\u0434\u0443\u044e\u0449\u0438\u0439 \u043f\u043e\u0442\u0435\u043d\u0446\u0438\u0430\u043b\u044c\u043d\u044b\u0439 \u043a\u043b\u0438\u0435\u043d\u0442: \u0418\u0440\u0438\u043d\u0430 \u0428\u043d\u0430\u0439\u0434\u0435\u0440, \u043d\u0443\u0436\u043d\u043e \u041a\u041f \u043d\u0430 \u0430\u0440\u0445\u0438\u0442\u0435\u043a\u0442\u0443\u0440\u0443, \u0430\u0434\u0440\u0435\u0441 Gartenweg 9, BGF 195 \u043c2.",
      receivedAt: "2026-06-05T10:00:00.000Z"
    });

    expect(result.action).toMatchObject({
      type: "create_lead"
    });
  });

  it("routes bare new-lead requests to a new lead session instead of parsing an empty lead", async () => {
    const result = await runCrmLangGraphOrchestrator({
      workspaceId: "workspace-demo",
      channel: "telegram",
      chatId: "410",
      messageId: "19",
      text: "/newlead",
      receivedAt: "2026-06-05T10:00:00.000Z"
    });

    expect(result.action).toMatchObject({
      type: "start_new_lead_session"
    });
  });

  it("routes natural Russian another-new-lead wording to lead creation", async () => {
    const result = await runCrmLangGraphOrchestrator({
      workspaceId: "workspace-demo",
      channel: "telegram",
      chatId: "410",
      messageId: "18",
      text: "Ещё новый лид: снова Максим, Швейцария, частный дом",
      receivedAt: "2026-06-05T10:00:00.000Z"
    });

    expect(result.action).toMatchObject({
      type: "create_lead"
    });
  });

  it("routes a replied field instruction to lead update", async () => {
    const result = await runCrmLangGraphOrchestrator({
      workspaceId: "workspace-demo",
      channel: "telegram",
      chatId: "410",
      messageId: "11",
      replyToLeadId: "L-2026-777",
      text: "Take only the client phone from the screenshot",
      receivedAt: "2026-06-05T10:00:00.000Z"
    });

    expect(result.action).toMatchObject({
      type: "update_lead",
      leadId: "L-2026-777",
      fieldCommand: {
        field: "phone",
        sourceScope: "attachments",
        only: true
      }
    });
  });

  it("routes forwarded material with a short lead reference to lead material attachment", async () => {
    const result = await runCrmLangGraphOrchestrator({
      workspaceId: "workspace-demo",
      channel: "telegram",
      chatId: "410",
      messageId: "16",
      text: "к лиду 009, возьми BGF отсюда",
      receivedAt: "2026-06-05T10:00:00.000Z",
      attachments: [{ id: "voice-file", kind: "audio", fileName: "whatsapp-audio.ogg" }]
    });

    expect(result.action).toMatchObject({
      type: "attach_material_to_lead",
      leadId: null,
      leadRef: "к лиду 009",
      materialKinds: ["audio"],
      fieldCommand: {
        field: "bgfM2",
        sourceScope: "any",
        only: false
      }
    });
  });

  it("routes material with a resolved selected lead to lead material attachment", async () => {
    const result = await runCrmLangGraphOrchestrator({
      workspaceId: "workspace-demo",
      channel: "telegram",
      chatId: "410",
      messageId: "17",
      selectedLeadId: "L-2026-009",
      text: "к лиду 009, добавь это к заявке",
      receivedAt: "2026-06-05T10:00:00.000Z",
      attachments: [{ id: "photo-file", kind: "image", fileName: "whatsapp-screen.jpg" }]
    });

    expect(result.action).toMatchObject({
      type: "attach_material_to_lead",
      leadId: "L-2026-009",
      leadRef: "к лиду 009",
      materialKinds: ["image"]
    });
  });

  it("routes a replied follow-up request to reminder creation", async () => {
    const result = await runCrmLangGraphOrchestrator({
      workspaceId: "workspace-demo",
      channel: "telegram",
      chatId: "410",
      messageId: "12",
      replyToLeadId: "L-2026-777",
      text: "remind me tomorrow to call the client about missing BGF",
      receivedAt: "2026-06-05T10:00:00.000Z"
    });

    expect(result.action).toMatchObject({
      type: "create_reminder",
      leadId: "L-2026-777",
      summary: expect.stringContaining("call the client"),
      dueAt: "2026-06-06T09:00:00.000Z"
    });
  });

  it("routes a replied personal context note to lead context", async () => {
    const result = await runCrmLangGraphOrchestrator({
      workspaceId: "workspace-demo",
      channel: "telegram",
      chatId: "410",
      messageId: "13",
      replyToLeadId: "L-2026-777",
      text:
        "\u0417\u0430\u043f\u043e\u043c\u043d\u0438 \u043e\u0431 \u044d\u0442\u043e\u043c \u043a\u043b\u0438\u0435\u043d\u0442\u0435: \u043b\u044e\u0431\u0438\u0442 \u0444\u0443\u0442\u0431\u043e\u043b \u0438 \u043a\u0430\u0436\u0434\u044b\u0439 \u0433\u043e\u0434 \u0445\u043e\u0434\u0438\u0442 \u043d\u0430 Oktoberfest.",
      receivedAt: "2026-06-05T10:00:00.000Z"
    });

    expect(result.action).toMatchObject({
      type: "add_context_note",
      leadId: "L-2026-777",
      note: expect.stringContaining("Oktoberfest")
    });
  });

  it("routes natural lead search requests to the search tool", async () => {
    const result = await runCrmLangGraphOrchestrator({
      workspaceId: "workspace-demo",
      channel: "telegram",
      chatId: "410",
      messageId: "14",
      text: "find client Schneider lake",
      receivedAt: "2026-06-05T10:00:00.000Z"
    });

    expect(result.action).toMatchObject({
      type: "search_leads",
      query: "find client Schneider lake"
    });
  });

  it("routes recent-list search requests to the search tool", async () => {
    const result = await runCrmLangGraphOrchestrator({
      workspaceId: "workspace-demo",
      channel: "telegram",
      chatId: "410",
      messageId: "15",
      text: "show last 10 leads",
      receivedAt: "2026-06-05T10:00:00.000Z"
    });

    expect(result.action).toMatchObject({
      type: "search_leads",
      query: "show last 10 leads"
    });
  });

  it("routes a plain message in active search mode to the search tool", async () => {
    const result = await runCrmLangGraphOrchestrator({
      workspaceId: "workspace-demo",
      channel: "telegram",
      chatId: "410",
      messageId: "20",
      activeMode: "search",
      text: "Schneider Chiemsee",
      receivedAt: "2026-06-05T10:00:00.000Z"
    });

    expect(result.action).toMatchObject({
      type: "search_leads",
      query: "Schneider Chiemsee"
    });
  });

  it("routes a non-replied message to the selected lead context", async () => {
    const result = await runCrmLangGraphOrchestrator({
      workspaceId: "workspace-demo",
      channel: "telegram",
      chatId: "410",
      messageId: "21",
      selectedLeadId: "L-2026-777",
      text: "phone +49 160 111222",
      receivedAt: "2026-06-05T10:00:00.000Z"
    });

    expect(result.action).toMatchObject({
      type: "update_lead",
      leadId: "L-2026-777"
    });
  });

  it("uses the CRM orchestrator client as the LangGraph classifier for natural lead search", async () => {
    const crmOrchestrator: CrmOrchestratorClient = {
      route: async () => ({
        intent: "SEARCH_LEAD",
        reasoning: "The user wants to find a lead by human-language text.",
        action: "Lead Search Agent",
        status: "ready",
        message: "Searching leads."
      })
    };

    const result = await runCrmLangGraphOrchestrator({
      workspaceId: "workspace-demo",
      channel: "telegram",
      chatId: "410",
      messageId: "22",
      text: "Максим Тютюник",
      crmOrchestrator,
      receivedAt: "2026-06-05T10:00:00.000Z"
    });

    expect(result.action).toMatchObject({
      type: "search_leads",
      query: "Максим Тютюник"
    });
  });

  it("uses the CRM orchestrator client decision to start a new lead session", async () => {
    const crmOrchestrator: CrmOrchestratorClient = {
      route: async () => ({
        intent: "START_NEW_LEAD_SESSION",
        reasoning: "The user wants to begin a new lead flow without source material yet.",
        action: "New Lead Session Agent",
        status: "ready",
        message: "Starting a new lead session."
      })
    };

    const result = await runCrmLangGraphOrchestrator({
      workspaceId: "workspace-demo",
      channel: "telegram",
      chatId: "410",
      messageId: "25",
      text: "хочу создать нового лида",
      crmOrchestrator,
      requireModelDecision: true,
      receivedAt: "2026-06-05T10:00:00.000Z"
    });

    expect(result.action).toMatchObject({
      type: "start_new_lead_session"
    });
  });

  it("does not use deterministic fallback when model decisions are required", async () => {
    const result = await runCrmLangGraphOrchestrator({
      workspaceId: "workspace-demo",
      channel: "telegram",
      chatId: "410",
      messageId: "26",
      text: "new lead: Irina Schneider wants an EFH proposal",
      requireModelDecision: true,
      receivedAt: "2026-06-05T10:00:00.000Z"
    });

    expect(result.action).toMatchObject({
      type: "clarify",
      question: expect.stringContaining("CRM orchestrator")
    });
  });

  it("uses the CRM orchestrator client decision to create a new lead even when a lead is selected", async () => {
    const crmOrchestrator: CrmOrchestratorClient = {
      route: async () => ({
        intent: "CREATE_LEAD",
        reasoning: "The user says this is a separate new lead.",
        action: "Lead Creation Agent",
        status: "ready",
        message: "Creating a new lead."
      })
    };

    const result = await runCrmLangGraphOrchestrator({
      workspaceId: "workspace-demo",
      channel: "telegram",
      chatId: "410",
      messageId: "23",
      selectedLeadId: "L-2026-010",
      text: "Это отдельная новая заявка по другому клиенту",
      crmOrchestrator,
      receivedAt: "2026-06-05T10:00:00.000Z"
    });

    expect(result.action).toMatchObject({
      type: "create_lead"
    });
  });

  it("uses the CRM orchestrator client question for ambiguous updates", async () => {
    const crmOrchestrator: CrmOrchestratorClient = {
      route: async () => ({
        intent: "CLARIFICATION_REQUIRED",
        reasoning: "The user wants to update something but no target lead is known.",
        action: "clarification",
        status: "need_clarification",
        message: "Which lead should I update?"
      })
    };

    const result = await runCrmLangGraphOrchestrator({
      workspaceId: "workspace-demo",
      channel: "telegram",
      chatId: "410",
      messageId: "24",
      text: "Добавь телефон клиента",
      crmOrchestrator,
      receivedAt: "2026-06-05T10:00:00.000Z"
    });

    expect(result.action).toMatchObject({
      type: "clarify",
      question: "Which lead should I update?"
    });
  });
});
