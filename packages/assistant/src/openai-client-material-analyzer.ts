import {
  createClientMaterialAnalysisJsonSchema,
  normalizeClientMaterialAnalysisResult,
  type ClientMaterialAnalyzer,
  type ClientMaterialAnalysisInput
} from "./client-material-analysis";
import type { AssistantChannelAttachment } from "./channel-message";

type ResponsesApiContentBlock = {
  type?: unknown;
  text?: unknown;
};

type OpenAiUserContentBlock =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string; detail: "high" }
  | { type: "input_file"; filename: string; file_data: string };

export function createOpenAiClientMaterialAnalyzer(config: {
  apiKey: string;
  model: string;
  prompt: string;
  fetchImpl?: typeof fetch;
}): ClientMaterialAnalyzer {
  const fetchImpl = config.fetchImpl ?? fetch;

  return {
    async analyze(input) {
      const response = await fetchImpl("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: config.model,
          input: [
            {
              role: "system",
              content: [
                config.prompt,
                "Return only JSON matching the provided schema.",
                "Use CRM field names exactly. Do not invent missing values."
              ].join("\n")
            },
            {
              role: "user",
              content: createOpenAiUserContent(input)
            }
          ],
          text: {
            format: {
              type: "json_schema",
              name: "client_material_analysis",
              schema: createClientMaterialAnalysisJsonSchema()
            }
          }
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI client material analyzer request failed: ${response.status} ${response.statusText}`);
      }

      const outputText = extractResponseOutputText(await response.json());
      if (!outputText) {
        throw new Error("OpenAI client material analyzer response did not include output_text");
      }

      return normalizeClientMaterialAnalysisResult(JSON.parse(outputText));
    }
  };
}

function createOpenAiUserContent(input: ClientMaterialAnalysisInput): string | OpenAiUserContentBlock[] {
  const text = [
    `Channel: ${input.channel}`,
    `Received at ${input.receivedAt}`,
    input.authorName ? `Author: ${input.authorName}` : "",
    input.authorUsername ? `Author username: ${input.authorUsername}` : "",
    "",
    input.text
  ]
    .filter((line) => line !== "")
    .join("\n");
  const attachments = input.attachments ?? [];

  if (attachments.length === 0) {
    return text;
  }

  return [
    { type: "input_text", text },
    ...attachments.flatMap<OpenAiUserContentBlock>((attachment) => createOpenAiAttachmentContent(attachment))
  ];
}

function createOpenAiAttachmentContent(attachment: AssistantChannelAttachment): OpenAiUserContentBlock[] {
  if (!attachment.base64) {
    return [];
  }

  if (attachment.kind === "photo") {
    return [
      {
        type: "input_image",
        image_url: `data:${attachment.mimeType};base64,${attachment.base64}`,
        detail: "high"
      }
    ];
  }

  if (attachment.kind === "pdf" || attachment.kind === "docx") {
    return [
      {
        type: "input_file",
        filename: attachment.fileName,
        file_data: attachment.base64
      }
    ];
  }

  if (attachment.kind === "text") {
    const text = decodeBase64Text(attachment.base64) ?? `Text attachment: ${attachment.fileName}`;
    return [{ type: "input_text", text }];
  }

  return [];
}

function decodeBase64Text(base64: string): string | null {
  try {
    if (typeof Buffer !== "undefined") {
      return Buffer.from(base64, "base64").toString("utf8");
    }

    return atob(base64);
  } catch {
    return null;
  }
}

function extractResponseOutputText(body: unknown): string | undefined {
  if (!body || typeof body !== "object") {
    return undefined;
  }

  if ("output_text" in body && typeof body.output_text === "string") {
    return body.output_text;
  }

  if (!("output" in body) || !Array.isArray(body.output)) {
    return undefined;
  }

  for (const item of body.output) {
    if (!item || typeof item !== "object" || !("content" in item) || !Array.isArray(item.content)) {
      continue;
    }

    const outputText = (item.content as ResponsesApiContentBlock[]).find((content) => content?.type === "output_text");
    if (outputText && typeof outputText.text === "string") {
      return outputText.text;
    }
  }

  return undefined;
}
