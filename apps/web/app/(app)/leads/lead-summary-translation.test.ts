import { describe, expect, it, vi } from "vitest";
import { translateLeadSummary } from "./lead-summary-translation";

describe("lead summary translation", () => {
  it("returns a user-facing error instead of throwing when OpenAI is not configured", async () => {
    await expect(
      translateLeadSummary({
        text: "Client wants an EFH proposal.",
        targetLanguage: "ru",
        apiKey: ""
      })
    ).resolves.toEqual({
      ok: false,
      error: "Lead summary translation is not configured."
    });
  });

  it("returns a user-facing error instead of throwing when OpenAI fails", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 500, statusText: "Server Error" })) as unknown as typeof fetch;

    await expect(
      translateLeadSummary({
        text: "Client wants an EFH proposal.",
        targetLanguage: "de",
        apiKey: "test-key",
        fetchImpl
      })
    ).resolves.toEqual({
      ok: false,
      error: "Lead summary translation failed. Please try again."
    });
  });

  it("extracts translated text from the Responses API output payload", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        output: [
          {
            type: "message",
            content: [{ type: "output_text", text: "Kunde mochte ein EFH-Angebot." }]
          }
        ]
      })
    })) as unknown as typeof fetch;

    await expect(
      translateLeadSummary({
        text: "Client wants an EFH proposal.",
        targetLanguage: "de",
        apiKey: "test-key",
        fetchImpl
      })
    ).resolves.toEqual({
      ok: true,
      text: "Kunde mochte ein EFH-Angebot."
    });
  });
});