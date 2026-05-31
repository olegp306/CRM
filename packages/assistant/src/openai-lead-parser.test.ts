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
            budgetEur: 32000,
            desiredStart: "2026-09",
            desiredMoveIn: "2027-07",
            isStandard: true,
            missingData: ["projectAddress", "bgfM2"],
            summary: "Ready except address and BGF",
            leadSummary: "Client source material has contact and budget but lacks project data.",
            documentSummaries: [
              {
                fileName: "brief.jpg",
                kind: "photo",
                summary: "Image likely contains project context.",
                transcript: null,
                storageKey: null,
                sourceUrl: null
              }
            ],
            suggestedReply: "Please send address and BGF."
          })
        })
      } as Response;
    });
    const parser = createOpenAiAssistantLeadParserClient({
      apiKey: "key",
      model: "gpt-test",
      prompt: "Workspace custom client material analysis prompt.",
      fetchImpl: fetch as unknown as typeof globalThis.fetch
    });

    const result = await parser.parseLead({
      text: "Please create a lead",
      receivedAt: "2026-05-26T08:00:00.000Z",
      attachments: [{ id: "photo-1", kind: "photo", fileName: "brief.jpg", mimeType: "image/jpeg", base64: "abcd" }]
    });

    expect(result.projectAddress).toBeUndefined();
    expect(result.bgfM2).toBeUndefined();
    expect(result.missingData).toEqual(["projectAddress", "bgfM2"]);
    expect(result.leadSummary).toContain("contact and budget");
    expect(result.documentSummaries?.[0]?.fileName).toBe("brief.jpg");
    const request = JSON.parse(String(fetch.mock.calls[0]?.[1]?.body));
    expect(request.input[0].content).toContain("Workspace custom client material analysis prompt.");
  });
});
