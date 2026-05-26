import { describe, expect, it, vi } from "vitest";
import { createLeadDraftFromAssistantChannelMessage } from "./lead-channel-intake";
import type { AssistantChannelMessage } from "./channel-message";

describe("lead channel intake", () => {
  it("creates a web lead draft from shared source material with attachment summaries", async () => {
    const message: AssistantChannelMessage = {
      channel: "web",
      threadId: "thread-1",
      messageId: "message-1",
      content: "Irina, house in Bad Aibling, BGF 195 m2, needs Neubau EFH",
      receivedAt: "2026-05-26T08:00:00.000Z",
      context: { workspaceId: "workspace-demo", userId: "user-demo", role: "admin" },
      attachments: [
        {
          id: "attachment-1",
          kind: "photo",
          fileName: "house.jpg",
          mimeType: "image/jpeg",
          base64: "abcd"
        }
      ]
    };
    const parser = {
      parseLead: vi.fn(async () => ({
        clientName: "Irina",
        requestType: "Neubau EFH",
        urgency: "medium" as const,
        temperature: "warm" as const,
        bgfM2: 195,
        projectAddress: "Bad Aibling",
        email: null,
        phone: null,
        missingData: ["email"],
        summary: "New EFH lead",
        suggestedReply: "Please send email."
      }))
    };

    const draft = await createLeadDraftFromAssistantChannelMessage(message, parser);

    expect(parser.parseLead).toHaveBeenCalledWith({
      text: message.content,
      receivedAt: message.receivedAt,
      attachments: message.attachments
    });
    expect(draft.source).toBe("web");
    expect(draft.clientName).toBe("Irina");
    expect(draft.bgfM2).toBe(195);
    expect(draft.temperature).toBe("warm");
    expect(draft.channelSourceExternalIds).toEqual(["web:thread-1:message-1"]);
    expect(draft.rawInput).toContain("web sources: web:thread-1:message-1");
    expect(draft.rawInput).toContain("Attachment 1: photo (house.jpg)");
    expect(draft.rawInput).toContain("Summary: New EFH lead");
    expect(draft.rawInput).toContain("Suggested reply: Please send email.");
    expect(draft.missingData).toContain("email");
  });

  it("merges parser missing data with core missing fields without duplicates", async () => {
    const draft = await createLeadDraftFromAssistantChannelMessage(
      {
        channel: "web",
        threadId: "thread-2",
        messageId: "message-2",
        content: "Lead has client name only",
        receivedAt: "2026-05-26T08:05:00.000Z",
        context: { workspaceId: "workspace-demo", userId: "user-demo", role: "admin" },
        attachments: []
      },
      {
        async parseLead() {
          return {
            clientName: "Irina",
            requestType: "Neubau EFH",
            urgency: "low",
            temperature: "unknown",
            email: null,
            phone: null,
            missingData: ["projectAddress", "budget"],
            summary: "Partial lead",
            suggestedReply: "Please send address and budget."
          };
        }
      }
    );

    expect(draft.missingData).toEqual(["projectAddress", "bgfM2", "budget"]);
  });

  it("records telegram channel source ids without using telegram-specific draft fields", async () => {
    const draft = await createLeadDraftFromAssistantChannelMessage(
      {
        channel: "telegram",
        threadId: "12345",
        messageId: "77",
        content: "Create lead for Irina",
        receivedAt: "2026-05-26T08:10:00.000Z",
        context: { workspaceId: "workspace-demo", userId: "telegram", role: "operator" },
        attachments: []
      },
      {
        async parseLead() {
          return {
            clientName: "Irina",
            requestType: "Renovation",
            urgency: "medium",
            temperature: "hot",
            projectAddress: "Munich",
            email: "irina@example.com",
            phone: "+49123456789",
            missingData: [],
            summary: "Telegram renovation lead",
            suggestedReply: "Thanks."
          };
        }
      }
    );

    expect(draft.source).toBe("telegram");
    expect(draft.channelSourceExternalIds).toEqual(["telegram:12345:77"]);
    expect("telegramSourceExternalId" in draft).toBe(false);
  });
});
