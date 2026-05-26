import { describe, expect, it, vi } from "vitest";
import { createOpenAiAudioTranscriber } from "./openai-audio-transcriber";

describe("openai audio transcriber", () => {
  it("posts audio as multipart form data and returns transcript text", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ text: "Full transcript from Telegram voice." })
    })) as unknown as typeof fetch;

    const transcriber = createOpenAiAudioTranscriber({
      apiKey: "test-key",
      model: "gpt-4o-mini-transcribe",
      fetchImpl
    });

    await expect(
      transcriber.transcribe({
        base64: Buffer.from("audio bytes").toString("base64"),
        mimeType: "audio/ogg",
        fileName: "telegram-voice-501.ogg",
        language: "ru"
      })
    ).resolves.toEqual({ text: "Full transcript from Telegram voice." });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.openai.com/v1/audio/transcriptions",
      expect.objectContaining({
        method: "POST",
        headers: { Authorization: "Bearer test-key" },
        body: expect.any(FormData)
      })
    );

    const form = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]?.body as FormData;
    expect(form.get("model")).toBe("gpt-4o-mini-transcribe");
    expect(form.get("language")).toBe("ru");
    expect(form.get("file")).toBeInstanceOf(File);
    expect((form.get("file") as File).name).toBe("telegram-voice-501.ogg");
    expect((form.get("file") as File).type).toBe("audio/ogg");
  });
});
