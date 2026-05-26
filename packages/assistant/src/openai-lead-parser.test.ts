import { describe, expect, it, vi } from "vitest";
import { createOpenAiAssistantLeadParserClient } from "./openai-lead-parser";

describe("createOpenAiAssistantLeadParserClient", () => {
  it("sends web source material attachments to the Responses API and normalizes nullable fields", async () => {
    const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.input[1].content[1]).toEqual({
        type: "input_image",
        image_url: "data:image/jpeg;base64,abcd",
        detail: "high"
      });

      return {
        ok: true,
        json: async () => ({
          output_text: JSON.stringify({
            clientName: "Irina Schneider",
            requestType: "new_build",
            urgency: "medium",
            temperature: "warm",
            bgfM2: null,
            projectAddress: null,
            email: "irina.schneider@example.com",
            phone: "+49 160 4442211",
            missingData: ["projectAddress", "bgfM2"],
            summary: "Ready except address and BGF",
            suggestedReply: "Please send address and BGF."
          })
        })
      } as Response;
    });
    const parser = createOpenAiAssistantLeadParserClient({ apiKey: "key", model: "gpt-test", fetchImpl: fetch as unknown as typeof globalThis.fetch });

    const result = await parser.parseLead({
      text: "Please create a lead",
      receivedAt: "2026-05-26T08:00:00.000Z",
      attachments: [{ id: "photo-1", kind: "photo", fileName: "brief.jpg", mimeType: "image/jpeg", base64: "abcd" }]
    });

    expect(result.projectAddress).toBeUndefined();
    expect(result.bgfM2).toBeUndefined();
    expect(result.missingData).toEqual(["projectAddress", "bgfM2"]);
  });
});
