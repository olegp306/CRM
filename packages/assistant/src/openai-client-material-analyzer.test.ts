import { describe, expect, it, vi } from "vitest";
import { createOpenAiClientMaterialAnalyzer } from "./openai-client-material-analyzer";

describe("openai client material analyzer", () => {
  it("passes workspace prompt and model into the Responses request", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        output_text: JSON.stringify({
          clientName: "Irina Schneider",
          requestType: "Neubau EFH",
          urgency: "medium",
          temperature: "warm",
          bgfM2: 195,
          projectAddress: "Bad Aibling, Gartenweg 9",
          email: "irina@example.com",
          phone: "+49 160 4442211",
          budgetEur: 32000,
          desiredStart: "2026-09",
          desiredMoveIn: "2027-07",
          isStandard: true,
          missingData: [],
          leadSummary: "Ready EFH proposal request.",
          documentSummaries: [
            {
              fileName: "brief.pdf",
              kind: "pdf",
              summary: "PDF describes the project address and BGF.",
              transcript: null,
              storageKey: "source/brief.pdf",
              sourceUrl: null
            }
          ],
          suggestedReply: "I created a lead and KP draft.",
          confidence: 0.91
        })
      })
    }));
    const analyzer = createOpenAiClientMaterialAnalyzer({
      apiKey: "openai-key",
      model: "gpt-4.1",
      prompt: "Custom architecture bureau metaprompt.",
      fetchImpl: fetchImpl as unknown as typeof fetch
    });

    const result = await analyzer.analyze({
      channel: "web",
      receivedAt: "2026-05-31T08:00:00.000Z",
      text: "Please create a proposal.",
      attachments: [
        {
          id: "attachment-1",
          kind: "pdf",
          fileName: "brief.pdf",
          mimeType: "application/pdf",
          base64: "abcd",
          storageKey: "source/brief.pdf"
        }
      ]
    });

    expect(result.leadSummary).toBe("Ready EFH proposal request.");
    expect(result.documentSummaries[0]?.summary).toContain("project address");

    const firstCall = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const request = JSON.parse(String(firstCall[1].body));
    expect(request.model).toBe("gpt-4.1");
    expect(request.input[0].content).toContain("Custom architecture bureau metaprompt.");
    expect(request.input[1].content[0].text).toContain("Received at 2026-05-31T08:00:00.000Z");
    expect(request.input[1].content[1]).toEqual(
      expect.objectContaining({
        type: "input_file",
        filename: "brief.pdf",
        file_data: "data:application/pdf;base64,abcd"
      })
    );
  });
});
