export type LeadSummaryTranslationResult =
  | {
      ok: true;
      text: string;
    }
  | {
      ok: false;
      error: string;
    };

type TranslateLeadSummaryInput = {
  text: string;
  targetLanguage: "ru" | "de";
  apiKey?: string;
  model?: string;
  fetchImpl?: typeof fetch;
};

export async function translateLeadSummary(input: TranslateLeadSummaryInput): Promise<LeadSummaryTranslationResult> {
  const text = input.text.trim();
  if (!text) {
    return { ok: true, text: "" };
  }

  const apiKey = input.apiKey?.trim() ?? "";
  if (!apiKey) {
    return { ok: false, error: "Lead summary translation is not configured." };
  }

  const targetLanguage = input.targetLanguage === "de" ? "German" : "Russian";

  try {
    const response = await (input.fetchImpl ?? fetch)("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: input.model || "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content:
              "Translate CRM lead summaries faithfully. Preserve names, addresses, dates, numbers, BGF, budgets, and product terms. Return only the translated text."
          },
          {
            role: "user",
            content: `Translate this lead summary to ${targetLanguage}:\n\n${text}`
          }
        ],
        temperature: 0.1
      })
    });

    if (!response.ok) {
      return { ok: false, error: "Lead summary translation failed. Please try again." };
    }

    const payload = (await response.json()) as unknown;
    const translated = extractOpenAiResponseText(payload);
    if (!translated) {
      return { ok: false, error: "Lead summary translation returned an empty response." };
    }

    return { ok: true, text: translated };
  } catch {
    return { ok: false, error: "Lead summary translation failed. Please try again." };
  }
}

function extractOpenAiResponseText(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const outputText = (payload as { output_text?: unknown }).output_text;
  if (typeof outputText === "string" && outputText.trim()) {
    return outputText.trim();
  }

  const output = (payload as { output?: unknown }).output;
  if (!Array.isArray(output)) {
    return "";
  }

  return output
    .flatMap((item) => {
      if (!item || typeof item !== "object") {
        return [];
      }

      const content = (item as { content?: unknown }).content;
      if (!Array.isArray(content)) {
        return [];
      }

      return content
        .map((part) => {
          if (!part || typeof part !== "object") {
            return "";
          }

          const text = (part as { text?: unknown }).text;
          return typeof text === "string" ? text.trim() : "";
        })
        .filter(Boolean);
    })
    .join("\n")
    .trim();
}
