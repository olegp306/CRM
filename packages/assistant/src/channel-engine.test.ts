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

  it("answers Telegram start command with shared help", () => {
    const result = createAssistantChannelResponse({
      ...baseMessage,
      channel: "telegram",
      content: "/start"
    });

    expect(result.intent).toBe("help");
    expect(result.shouldPersistFeedback).toBe(false);
    expect(result.text).toContain("I can create and update leads");
  });

  it("treats web source material with attachments as lead intake, not product feedback", () => {
    const result = createAssistantChannelResponse({
      ...baseMessage,
      channel: "web",
      content: "Вот заявка клиента, создай лид если данных хватает",
      attachments: [{ id: "photo-1", kind: "photo", fileName: "brief.jpg", mimeType: "image/jpeg", base64: "abcd" }]
    });

    expect(result.intent).toBe("lead_intake");
    expect(result.shouldPersistFeedback).toBe(false);
    expect(result.feedbackType).toBeUndefined();
    expect(result.buttons).toEqual([{ label: "Create lead", action: "confirm" }]);
    expect(result.text).toContain("I can create a lead from this source material");
    expect(result.text).toContain("client, request, address, BGF, contacts");
    expect(result.text).toContain("missing KP fields");
    expect(result.text).toContain("source references");
  });

  it("keeps neutral source material with attachments as lead intake", () => {
    const result = createAssistantChannelResponse({
      ...baseMessage,
      channel: "web",
      content: "Please review this client request",
      attachments: [{ id: "photo-1", kind: "photo", fileName: "request.jpg", mimeType: "image/jpeg", base64: "abcd" }]
    });

    expect(result.intent).toBe("lead_intake");
    expect(result.shouldPersistFeedback).toBe(false);
    expect(result.feedbackType).toBeUndefined();
    expect(result.buttons).toEqual([{ label: "Create lead", action: "confirm" }]);
  });

  it("treats clear English lead source material as lead intake", () => {
    const result = createAssistantChannelResponse({
      ...baseMessage,
      channel: "web",
      content: "Source material for a new lead: client Schmidt wants a commercial proposal for BGF 240 m2 at Rosenheim."
    });

    expect(result.intent).toBe("lead_intake");
    expect(result.shouldPersistFeedback).toBe(false);
    expect(result.feedbackType).toBeUndefined();
    expect(result.buttons).toEqual([{ label: "Create lead", action: "confirm" }]);
  });

  it("treats clear English lead creation from client request text as lead intake", () => {
    const result = createAssistantChannelResponse({
      ...baseMessage,
      channel: "web",
      content: "Create a lead from this client request with address and BGF"
    });

    expect(result.intent).toBe("lead_intake");
    expect(result.shouldPersistFeedback).toBe(false);
    expect(result.feedbackType).toBeUndefined();
    expect(result.buttons).toEqual([{ label: "Create lead", action: "confirm" }]);
  });

  it("treats clear Russian commercial proposal source material as lead intake", () => {
    const result = createAssistantChannelResponse({
      ...baseMessage,
      channel: "web",
      content: "Материал для лида: клиент просит коммерческое предложение, адрес Мюнхен, BGF 180 м2."
    });

    expect(result.intent).toBe("lead_intake");
    expect(result.shouldPersistFeedback).toBe(false);
    expect(result.feedbackType).toBeUndefined();
    expect(result.buttons).toEqual([{ label: "Create lead", action: "confirm" }]);
  });

  it("treats clear Russian client request text as lead intake", () => {
    const result = createAssistantChannelResponse({
      ...baseMessage,
      channel: "web",
      content: "Вот заявка клиента, создай лид если данных хватает"
    });

    expect(result.intent).toBe("lead_intake");
    expect(result.shouldPersistFeedback).toBe(false);
    expect(result.feedbackType).toBeUndefined();
    expect(result.buttons).toEqual([{ label: "Create lead", action: "confirm" }]);
  });

  it("keeps add lead button complaints as persisted UX feedback", () => {
    const result = createAssistantChannelResponse({
      ...baseMessage,
      channel: "web",
      content: "Add lead button is confusing"
    });

    expect(result.intent).toBe("ux_feedback");
    expect(result.shouldPersistFeedback).toBe(true);
    expect(result.feedbackType).toBe("ux_feedback");
    expect(result.buttons).toEqual([]);
  });

  it("keeps add lead button bug reports with screenshots as persisted feedback", () => {
    const result = createAssistantChannelResponse({
      ...baseMessage,
      channel: "web",
      content: "Add lead button is broken",
      attachments: [{ id: "screenshot-1", kind: "photo", fileName: "broken-button.png", mimeType: "image/png", base64: "abcd" }]
    });

    expect(result.intent).toBe("bug_report");
    expect(result.shouldPersistFeedback).toBe(true);
    expect(result.feedbackType).toBe("bug_report");
    expect(result.buttons).toEqual([]);
  });

  it("keeps create lead button UX complaints as persisted feedback", () => {
    const result = createAssistantChannelResponse({
      ...baseMessage,
      channel: "web",
      content: "Create lead button is confusing"
    });

    expect(result.intent).toBe("ux_feedback");
    expect(result.shouldPersistFeedback).toBe(true);
    expect(result.feedbackType).toBe("ux_feedback");
    expect(result.buttons).toEqual([]);
  });

  it("keeps lead status questions as support requests", () => {
    const result = createAssistantChannelResponse({
      ...baseMessage,
      channel: "web",
      content: "What is the status of lead L-2026-004?"
    });

    expect(result.intent).toBe("support_request");
    expect(result.shouldPersistFeedback).toBe(false);
    expect(result.feedbackType).toBeUndefined();
    expect(result.buttons).toEqual([]);
  });

  it("keeps lead status questions with screenshots as support requests", () => {
    const result = createAssistantChannelResponse({
      ...baseMessage,
      channel: "web",
      content: "What is the status of lead L-2026-004?",
      attachments: [{ id: "screenshot-1", kind: "photo", fileName: "lead-status.png", mimeType: "image/png", base64: "abcd" }]
    });

    expect(result.intent).toBe("support_request");
    expect(result.intent).not.toBe("lead_intake");
    expect(result.shouldPersistFeedback).toBe(false);
    expect(result.feedbackType).toBeUndefined();
    expect(result.buttons).toEqual([]);
    expect(result.buttons).not.toContainEqual({ label: "Create lead", action: "confirm" });
  });

  it.each(["lead", "client", "address", "BGF"])("does not treat the single word %s as lead intake", (content) => {
    const result = createAssistantChannelResponse({
      ...baseMessage,
      channel: "web",
      content
    });

    expect(result.intent).not.toBe("lead_intake");
    expect(result.shouldPersistFeedback).toBe(false);
    expect(result.buttons).toEqual([]);
  });
});
