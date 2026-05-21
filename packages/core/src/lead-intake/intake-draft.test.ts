import { describe, expect, it } from "vitest";
import { createLeadIntakeDraft, createTelegramLeadIntakeDraft } from "./intake-draft";

describe("lead intake draft", () => {
  it("normalizes manual web lead input into a database-ready draft", () => {
    expect(
      createLeadIntakeDraft({
        source: "web",
        clientName: " Anna Beispiel ",
        email: " anna@example.com ",
        phone: " +49 30 123 ",
        requestType: "new_build",
        projectAddress: " Beispielstrasse 1 ",
        bgfM2: "150",
        rawInput: " Manual note "
      })
    ).toEqual({
      source: "web",
      clientName: "Anna Beispiel",
      email: "anna@example.com",
      phone: "+49 30 123",
      requestType: "new_build",
      projectAddress: "Beispielstrasse 1",
      bgfM2: 150,
      rawInput: "Manual note",
      missingData: [],
      isStandard: true
    });
  });

  it("creates the same draft shape from a Telegram message", () => {
    expect(
      createTelegramLeadIntakeDraft({
        fromName: "Ivan Telegram",
        messageText: "Новый дом, BGF 180, Chiemseeufer 7, ivan@example.com, +49 170 123456",
        messageUrl: "https://t.me/c/123/456"
      })
    ).toMatchObject({
      source: "telegram",
      clientName: "Ivan Telegram",
      email: "ivan@example.com",
      phone: "+49 170 123456",
      requestType: "new_build",
      projectAddress: "Chiemseeufer 7",
      bgfM2: 180,
      rawInput: "Новый дом, BGF 180, Chiemseeufer 7, ivan@example.com, +49 170 123456\nTelegram: https://t.me/c/123/456",
      missingData: [],
      isStandard: true
    });
  });

  it("keeps missing data explicit for incomplete inbound messages", () => {
    expect(
      createTelegramLeadIntakeDraft({
        fromName: "",
        messageText: "Bitte Angebot vorbereiten"
      })
    ).toMatchObject({
      source: "telegram",
      clientName: null,
      bgfM2: null,
      missingData: ["clientName", "requestType", "projectAddress"],
      isStandard: false
    });
  });
});
