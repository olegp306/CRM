import { describe, expect, it } from "vitest";
import { createAssistantChannelResponse } from "./channel-engine";
import type { AssistantChannelMessage } from "./channel-message";

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

describe("assistant channel message contracts", () => {
  it("represents a web message with attachments and selected CRM context", () => {
    const message: AssistantChannelMessage = {
      channel: "web",
      threadId: "thread-1",
      messageId: "message-1",
      content: "Create a lead from this PDF",
      receivedAt: "2026-05-26T08:00:00.000Z",
      context: {
        workspaceId: "workspace-demo",
        userId: "user-demo",
        role: "admin",
        route: "/leads",
        module: "leads",
        selectedRecordIds: ["L-2026-004"]
      },
      attachments: [
        {
          id: "attachment-1",
          kind: "pdf",
          fileName: "lead.pdf",
          mimeType: "application/pdf",
          base64: "JVBERi0x"
        }
      ]
    };

    expect(message.channel).toBe("web");
    expect(message.attachments[0]?.kind).toBe("pdf");
  });
});

describe("assistant channel engine", () => {
  it("answers capability questions consistently in web", () => {
    const result = createAssistantChannelResponse({
      ...baseMessage,
      channel: "web",
      content: "Кто ты и что умеешь?"
    });

    expect(result.intent).toBe("help");
    expect(result.shouldPersistFeedback).toBe(false);
    expect(result.text).toContain("I can create and update leads");
  });

  it("answers capability questions consistently in Telegram", () => {
    const result = createAssistantChannelResponse({
      ...baseMessage,
      channel: "telegram",
      content: "/help"
    });

    expect(result.intent).toBe("help");
    expect(result.shouldPersistFeedback).toBe(false);
    expect(result.text).toContain("I can create and update leads");
  });
});
