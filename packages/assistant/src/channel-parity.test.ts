import { describe, expect, it } from "vitest";
import { createAssistantChannelResponse } from "./channel-engine";
import type { AssistantChannelMessage, AssistantChannelResponse } from "./channel-message";

const baseMessage = {
  threadId: "thread-1",
  messageId: "message-1",
  receivedAt: "2026-05-26T08:00:00.000Z",
  context: {
    workspaceId: "workspace-demo",
    userId: "user-demo",
    role: "admin",
    route: "/leads",
    module: "leads"
  },
  attachments: []
} satisfies Omit<AssistantChannelMessage, "channel" | "content">;

describe("assistant channel parity", () => {
  it("returns equivalent lead intake intent for Telegram and Web source material", () => {
    const web = createAssistantChannelResponse({
      ...baseMessage,
      channel: "web",
      content: "Create a lead from this client request: Katya needs a KP for BGF 180 m2 at Chiemseeufer 7."
    });
    const telegram = createAssistantChannelResponse({
      ...baseMessage,
      channel: "telegram",
      content: "Create a lead from this client request: Katya needs a KP for BGF 180 m2 at Chiemseeufer 7."
    });

    expect(toComparableResponse(web)).toEqual(toComparableResponse(telegram));
  });

  it("returns equivalent update intent for Telegram reply and Web selected lead", () => {
    const web = createAssistantChannelResponse({
      ...baseMessage,
      channel: "web",
      content: "Add source material with address Chiemseeufer 7.",
      context: {
        ...baseMessage.context,
        selectedRecordIds: ["L-2026-004"]
      },
      attachments: [{ id: "pdf-1", kind: "pdf", fileName: "brief.pdf", mimeType: "application/pdf" }]
    });
    const telegram = createAssistantChannelResponse({
      ...baseMessage,
      channel: "telegram",
      content: "Add source material with address Chiemseeufer 7.",
      replyTo: {
        sourceChannel: "telegram",
        sourceMessageId: "900",
        leadId: "L-2026-004"
      },
      attachments: [{ id: "pdf-1", kind: "pdf", fileName: "brief.pdf", mimeType: "application/pdf" }]
    });

    expect(toComparableResponse(web)).toEqual(toComparableResponse(telegram));
    expect(getLeadTargetId(web)).toBe("L-2026-004");
  });

  it("returns equivalent KP-ready actions for both channels", () => {
    const lead = {
      leadId: "L-2026-011",
      missingFields: [],
      kpReady: true,
      pdfUrl: "/documents/attachments/pdf-1",
      docxUrl: "/documents/attachments/docx-1?download=1",
      canSendKp: true,
      kpSent: true
    };
    const web = createAssistantChannelResponse(
      {
        ...baseMessage,
        channel: "web",
        content: "Is KP ready?"
      },
      { lead }
    );
    const telegram = createAssistantChannelResponse(
      {
        ...baseMessage,
        channel: "telegram",
        content: "Is KP ready?"
      },
      { lead }
    );

    expect(toComparableResponse(web)).toEqual(toComparableResponse(telegram));
    expect(web.normalizedActions).toEqual(["open_crm", "open_pdf", "download_doc", "send_kp", "mark_kp_sent", "undo_kp_sent"]);
  });

  it("routes theme capability questions away from lead intake in both channels", () => {
    const content = "Р° РµСЃС‚СЊ С†РІРµС‚РѕРІР°СЏ СЃС…РµРјР° РёР»Рё С‚РµРјР° С‚РµРјРЅР°СЏ РґР»СЏ РІРµС‡РµСЂР° ?";
    const web = createAssistantChannelResponse({ ...baseMessage, channel: "web", content });
    const telegram = createAssistantChannelResponse({ ...baseMessage, channel: "telegram", content });

    expect(web.intent).toBe("capability_request");
    expect(telegram.intent).toBe("feature_request");
    expect(web.intent).not.toBe("lead_intake");
    expect(telegram.intent).not.toBe("lead_intake");
    expect(web.normalizedActions).toEqual(telegram.normalizedActions);
  });
});

function toComparableResponse(response: AssistantChannelResponse) {
  return {
    intent: response.intent,
    normalizedActions: response.normalizedActions ?? [],
    shouldPersistFeedback: response.shouldPersistFeedback,
    feedbackType: response.feedbackType,
    leadTargetId: getLeadTargetId(response)
  };
}

function getLeadTargetId(response: AssistantChannelResponse): string | null {
  const crmUrl = response.buttons.find((button) => button.action === "open_crm" || button.label === "CRM")?.url;
  return /leadId=([^&]+)/.exec(crmUrl ?? "")?.[1] ?? null;
}
