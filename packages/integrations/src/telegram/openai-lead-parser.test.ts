import { describe, expect, it, vi } from "vitest";
import { createLeadDraftFromTelegramMessage, createOpenAiLeadParserClient } from "./openai-lead-parser";

describe("openai lead parser", () => {
  it("maps parsed Telegram content into the current CRM lead intake draft", async () => {
    const parser = {
      parseLead: vi.fn(async () => ({
        clientName: "Fam. Schneider",
        requestType: "new_build",
        urgency: "high" as const,
        temperature: "hot" as const,
        bgfM2: 160,
        projectAddress: "Chiemseeufer 7",
        email: "fam@example.com",
        phone: "+49 170 123456",
        missingData: [],
        summary: "Standard EFH lead",
        suggestedReply: "Danke, wir pruefen das."
      }))
    };

    await expect(
      createLeadDraftFromTelegramMessage(
        {
          chatId: "123",
          messageId: 8,
          receivedAt: "2026-05-20T17:00:00.000Z",
          text: "Need EFH offer"
        },
        parser
      )
    ).resolves.toMatchObject({
      source: "telegram",
      clientName: "Fam. Schneider",
      email: "fam@example.com",
      phone: "+49 170 123456",
      requestType: "new_build",
      projectAddress: "Chiemseeufer 7",
      bgfM2: 160,
      rawInput: "Need EFH offer\nTelegram source: telegram:123:8\nSummary: Standard EFH lead\nSuggested reply: Danke, wir pruefen das.",
      missingData: [],
      isStandard: true
    });
  });

  it("sends image and PDF attachments to OpenAI Responses as multimodal input", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        output_text: JSON.stringify({
          clientName: "Attachment Lead",
          requestType: "new_build",
          urgency: "medium",
          temperature: "warm",
          bgfM2: 180,
          projectAddress: "Planweg 1",
          email: null,
          phone: null,
          missingData: [],
          summary: "Attachment parsed",
          suggestedReply: "We will review."
        })
      })
    }));
    const parser = createOpenAiLeadParserClient({
      apiKey: "openai-key",
      model: "gpt-4o-mini",
      fetchImpl: fetchMock as unknown as typeof fetch
    });

    await parser.parseLead({
      text: "See attached",
      receivedAt: "2026-05-20T17:00:00.000Z",
      attachments: [
        { kind: "photo", mimeType: "image/jpeg", base64: "AQID" },
        { kind: "pdf", mimeType: "application/pdf", fileName: "lead.pdf", base64: "BAUG" }
      ]
    });

    const firstCall = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(firstCall[1].body));
    expect(body.input[1].content).toEqual([
      { type: "input_text", text: "Received at 2026-05-20T17:00:00.000Z\n\nSee attached" },
      { type: "input_image", image_url: "data:image/jpeg;base64,AQID", detail: "high" },
      { type: "input_file", filename: "lead.pdf", file_data: "BAUG" }
    ]);
  });
});
