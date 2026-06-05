import { describe, expect, it } from "vitest";
import { runCrmLangGraphOrchestrator } from "./crm-langgraph-orchestrator";

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
});
