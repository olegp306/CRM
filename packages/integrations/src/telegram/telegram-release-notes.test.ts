import { describe, expect, it, vi } from "vitest";
import { createTelegramReleaseNotesMessage, sendTelegramReleaseNotes } from "./telegram-release-notes";

describe("telegram release notes", () => {
  it("formats a short quiet release message instead of a long changelog", () => {
    const message = createTelegramReleaseNotesMessage({
      version: "0.2.3",
      notes: [
        "Lead cards now open fullscreen from table rows and Telegram CRM links.",
        "Telegram replies can save short human notes into lead history.",
        "CRM buttons are returned after lead updates.",
        "This extra item should stay out of the quiet Telegram announcement."
      ]
    });

    expect(message).toContain("CRM updated to v0.2.3");
    expect(message).toContain("Lead cards now open fullscreen");
    expect(message).toContain("Telegram replies can save");
    expect(message).toContain("CRM buttons are returned");
    expect(message).not.toContain("extra item");
    expect(message.length).toBeLessThanOrEqual(520);
  });

  it("does not send anything unless confirm is explicit", async () => {
    const fetchMock = vi.fn();

    const result = await sendTelegramReleaseNotes({
      botToken: "telegram-token",
      chatIds: ["12345"],
      crmBaseUrl: "https://crm.example.com",
      version: "0.2.3",
      notes: ["Quiet release note"],
      confirm: false,
      fetchImpl: fetchMock as unknown as typeof fetch
    });

    expect(result).toEqual({
      mode: "preview",
      chatIds: ["12345"],
      sent: 0,
      message: expect.stringContaining("CRM updated to v0.2.3")
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends confirmed release notes silently with a CRM button", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/sendMessage")) {
        return { ok: true, status: 200, json: async () => ({ ok: true, result: { message_id: 91 } }) };
      }

      throw new Error(`Unexpected URL ${url}`);
    });

    const result = await sendTelegramReleaseNotes({
      botToken: "telegram-token",
      chatIds: ["12345", "777"],
      crmBaseUrl: "https://crm.example.com",
      version: "0.2.3",
      notes: ["Quiet release note"],
      confirm: true,
      fetchImpl: fetchMock as unknown as typeof fetch
    });

    expect(result).toEqual({
      mode: "sent",
      chatIds: ["12345", "777"],
      sent: 2,
      message: expect.stringContaining("CRM updated to v0.2.3")
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstCall = fetchMock.mock.calls[0] as unknown as [string, { body?: unknown }];
    const firstBody = JSON.parse(String(firstCall[1].body));
    expect(firstBody).toEqual(
      expect.objectContaining({
        chat_id: "12345",
        disable_notification: true,
        text: expect.stringContaining("Quiet release note"),
        reply_markup: {
          inline_keyboard: [[{ text: "CRM", url: "https://crm.example.com" }]]
        }
      })
    );
  });
});
