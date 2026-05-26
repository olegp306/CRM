import { describe, expect, it } from "vitest";
import { createCapabilityResponse, findAssistantCapability } from "./capability-registry";
import type { AssistantChannelMessage } from "./channel-message";

const baseMessage = {
  threadId: "thread-1",
  messageId: "message-1",
  receivedAt: "2026-05-26T09:00:00.000Z",
  context: {
    workspaceId: "workspace-demo",
    userId: "user-demo",
    role: "admin",
    route: "/leads",
    module: "leads"
  },
  attachments: []
} satisfies Omit<AssistantChannelMessage, "channel" | "content">;

describe("assistant capability registry", () => {
  it("detects Russian dark-theme availability questions as theme switching capability", () => {
    const capability = findAssistantCapability("а есть цветовая схема или тема темная для вечера ?");

    expect(capability?.id).toBe("theme_switching");
    expect(capability?.available).toBe(true);
  });

  it("answers web theme requests with direct theme switch buttons", () => {
    const response = createCapabilityResponse({
      ...baseMessage,
      channel: "web",
      content: "а есть цветовая схема или тема темная для вечера ?"
    });

    expect(response?.intent).toBe("capability_request");
    expect(response?.shouldPersistFeedback).toBe(false);
    expect(response?.buttons).toEqual([
      { label: "Nocturne", action: "set_theme", value: "nocturne" },
      { label: "Graphite", action: "set_theme", value: "graphite" },
      { label: "Settings", url: "/settings/branding" }
    ]);
    expect(response?.text).toContain("Nocturne");
    expect(response?.text).toContain("Graphite");
  });

  it("answers Telegram theme requests with settings link and records the missing channel action", () => {
    const response = createCapabilityResponse({
      ...baseMessage,
      channel: "telegram",
      content: "а есть цветовая схема или тема темная для вечера ?"
    });

    expect(response?.intent).toBe("feature_request");
    expect(response?.shouldPersistFeedback).toBe(true);
    expect(response?.feedbackType).toBe("feature_request");
    expect(response?.buttons).toEqual([{ label: "Settings", url: "/settings/branding" }]);
    expect(response?.text).toContain("Telegram");
  });
});
