import { describe, expect, it } from "vitest";
import {
  getKpRequiredFieldStatus,
  isPossibleDifferentLead,
  mergeTelegramLeadDraftSession,
  type TelegramLeadDraftSession
} from "./telegram-lead-draft-session";
import type { TelegramLeadIntakeDraft } from "./openai-lead-parser";

const baseSession: TelegramLeadDraftSession = {
  chatId: "12345",
  workspaceId: "workspace-demo",
  startedAt: "2026-05-22T10:00:00.000Z",
  updatedAt: "2026-05-22T10:00:00.000Z",
  sourceMessageIds: [5],
  draft: {
    source: "telegram",
    clientName: "Katya",
    email: null,
    phone: null,
    requestType: "new_build",
    projectAddress: null,
    bgfM2: null,
    rawInput: "Initial message",
    missingData: ["projectAddress", "bgfM2"],
    isStandard: false,
    telegramSourceExternalId: "telegram:12345:5",
    temperature: "warm"
  }
};

describe("telegram lead draft session", () => {
  it("tracks KP-required fields and treats BGF as required for new builds", () => {
    expect(getKpRequiredFieldStatus(baseSession.draft)).toEqual({
      ready: false,
      present: ["clientName", "requestType"],
      missing: ["projectAddress", "bgfM2"]
    });
  });

  it("can use current template placeholders as KP-required fields", () => {
    expect(getKpRequiredFieldStatus(baseSession.draft, ["clientName", "projectAddress"])).toEqual({
      ready: false,
      present: ["clientName"],
      missing: ["projectAddress"]
    });

    expect(
      getKpRequiredFieldStatus(
        {
          ...baseSession.draft,
          projectAddress: "Ленина 12",
          requestType: null,
          bgfM2: null
        },
        ["clientName", "projectAddress"]
      )
    ).toEqual({
      ready: true,
      present: ["clientName", "projectAddress"],
      missing: []
    });
  });

  it("merges follow-up Telegram drafts without losing existing fields", () => {
    const update = createDraftUpdate({
      projectAddress: "Chiemseeufer 7",
      bgfM2: 180,
      rawInput: "BGF 180, Chiemseeufer 7",
      missingData: []
    });

    const merged = mergeTelegramLeadDraftSession(baseSession, update, {
      receivedAt: "2026-05-22T10:02:00.000Z",
      sourceMessageIds: [6]
    });

    expect(merged).toMatchObject({
      updatedAt: "2026-05-22T10:02:00.000Z",
      sourceMessageIds: [5, 6],
      draft: {
        clientName: "Katya",
        requestType: "new_build",
        projectAddress: "Chiemseeufer 7",
        bgfM2: 180,
        missingData: []
      }
    });
    expect(merged.draft.rawInput).toContain("Initial message");
    expect(merged.draft.rawInput).toContain("BGF 180, Chiemseeufer 7");
    expect(getKpRequiredFieldStatus(merged.draft).ready).toBe(true);
  });

  it("flags a possible different lead when client and address both change", () => {
    const session = {
      ...baseSession,
      draft: {
        ...baseSession.draft,
        projectAddress: "Chiemseeufer 7"
      }
    };
    const update = createDraftUpdate({
      clientName: "Max",
      projectAddress: "Munich",
      bgfM2: 220
    });

    expect(isPossibleDifferentLead(session, update)).toBe(true);
  });

  it("does not flag a different lead for ordinary missing-field updates", () => {
    const update = createDraftUpdate({
      clientName: "Katya",
      projectAddress: "Chiemseeufer 7",
      bgfM2: 180
    });

    expect(isPossibleDifferentLead(baseSession, update)).toBe(false);
  });

  it("can find an active draft by the Telegram bot message id", async () => {
    const { createMemoryTelegramLeadDraftSessionStore } = await import("./telegram-lead-draft-session");
    const store = createMemoryTelegramLeadDraftSessionStore();
    const session = { ...baseSession, telegramDraftMessageId: 500 };

    await store.save(session);

    await expect(store.getByTelegramMessage?.({ workspaceId: "workspace-demo", chatId: "12345", messageId: 500 })).resolves.toMatchObject({
      telegramDraftMessageId: 500
    });
    await expect(store.getByTelegramMessage?.({ workspaceId: "workspace-demo", chatId: "12345", messageId: 501 })).resolves.toBeNull();
  });
});

function createDraftUpdate(overrides: Partial<TelegramLeadIntakeDraft>): TelegramLeadIntakeDraft {
  return {
    source: "telegram",
    clientName: null,
    email: null,
    phone: null,
    requestType: null,
    projectAddress: null,
    bgfM2: null,
    rawInput: "Update message",
    missingData: ["clientName", "requestType", "projectAddress"],
    isStandard: false,
    telegramSourceExternalId: "telegram:12345:6",
    temperature: "unknown",
    ...overrides
  };
}
