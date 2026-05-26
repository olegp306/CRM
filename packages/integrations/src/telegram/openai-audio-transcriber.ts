export type TelegramAudioTranscriber = {
  transcribe(input: { base64: string; mimeType: string; fileName: string; language?: string }): Promise<{ text: string }>;
};

export function createOpenAiAudioTranscriber(config: {
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
}): TelegramAudioTranscriber {
  const fetchImpl = config.fetchImpl ?? fetch;

  return {
    async transcribe(input) {
      const form = new FormData();
      const file = new File([Buffer.from(input.base64, "base64")], input.fileName, { type: input.mimeType });

      form.set("model", config.model);
      form.set("file", file);

      if (input.language) {
        form.set("language", input.language);
      }

      const response = await fetchImpl("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`
        },
        body: form
      });

      if (!response.ok) {
        throw new Error(`OpenAI audio transcription failed: ${response.status} ${response.statusText}`);
      }

      const body = (await response.json()) as { text?: unknown };
      if (typeof body.text !== "string") {
        throw new Error("OpenAI audio transcription response did not include text");
      }

      return { text: body.text };
    }
  };
}
