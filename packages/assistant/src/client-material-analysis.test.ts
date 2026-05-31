import { describe, expect, it } from "vitest";
import { normalizeClientMaterialAnalysisResult } from "./client-material-analysis";

describe("client material analysis", () => {
  it("normalizes nullable AI output into CRM-friendly optional fields", () => {
    const result = normalizeClientMaterialAnalysisResult({
      clientName: "Irina Schneider",
      requestType: "Neubau EFH",
      urgency: "medium",
      temperature: "warm",
      bgfM2: null,
      projectAddress: null,
      email: "irina@example.com",
      phone: null,
      budgetEur: 32000,
      desiredStart: "2026-09",
      desiredMoveIn: null,
      isStandard: null,
      missingData: ["projectAddress", "bgfM2"],
      leadSummary: "Client needs a commercial proposal for a new EFH.",
      documentSummaries: [
        {
          fileName: "voice.ogg",
          kind: "audio",
          summary: "Audio contains client name and budget.",
          transcript: "Здравствуйте, меня зовут Ирина...",
          storageKey: "telegram/audio/voice.ogg"
        }
      ],
      suggestedReply: "Please send project address and BGF.",
      confidence: 0.74
    });

    expect(result.bgfM2).toBeUndefined();
    expect(result.projectAddress).toBeUndefined();
    expect(result.phone).toBeNull();
    expect(result.isStandard).toBeNull();
    expect(result.documentSummaries[0]).toEqual(
      expect.objectContaining({
        fileName: "voice.ogg",
        kind: "audio",
        summary: "Audio contains client name and budget.",
        transcript: "Здравствуйте, меня зовут Ирина..."
      })
    );
  });
});
