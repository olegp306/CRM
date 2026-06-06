import type { AssistantChannelMessage } from "./channel-message";
import {
  type CrmOrchestratorDecision,
  type CrmOrchestratorIntent,
  type CrmOrchestratorStatus
} from "./crm-orchestrator-agent";

type ResponsesApiContentBlock = {
  type?: unknown;
  text?: unknown;
};

export type CrmOrchestratorClient = {
  route(message: AssistantChannelMessage): Promise<CrmOrchestratorDecision>;
};

export function createOpenAiCrmOrchestrator(config: {
  apiKey: string;
  model: string;
  prompt: string;
  fetchImpl?: typeof fetch;
}): CrmOrchestratorClient {
  const fetchImpl = config.fetchImpl ?? fetch;

  return {
    async route(message) {
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
                "Do not mutate CRM data. Only classify, route, and ask one clarification when required."
              ].join("\n")
            },
            {
              role: "user",
              content: createCrmOrchestratorUserContent(message)
            }
          ],
          text: {
            format: {
              type: "json_schema",
              name: "crm_orchestrator_decision",
              schema: createCrmOrchestratorJsonSchema()
            }
          }
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI CRM orchestrator request failed: ${response.status} ${response.statusText}`);
      }

      const outputText = extractResponseOutputText(await response.json());
      if (!outputText) {
        throw new Error("OpenAI CRM orchestrator response did not include output_text");
      }

      return normalizeCrmOrchestratorDecision(JSON.parse(outputText));
    }
  };
}

function createCrmOrchestratorUserContent(message: AssistantChannelMessage): string {
  const replyLeadId = message.replyTo?.leadId ? `Reply lead id: ${message.replyTo.leadId}` : "";
  const selectedIds = message.context.selectedRecordIds?.length ? `Selected records: ${message.context.selectedRecordIds.join(", ")}` : "";
  const attachments = message.attachments.length
    ? `Attachments: ${message.attachments.map((attachment) => `${attachment.kind}:${attachment.fileName}`).join(", ")}`
    : "";

  return [
    `Channel: ${message.channel}`,
    `Thread: ${message.threadId}`,
    `Message id: ${message.messageId}`,
    `Received at: ${message.receivedAt}`,
    `Workspace: ${message.context.workspaceId}`,
    `User: ${message.context.userId}`,
    `Module: ${message.context.module ?? "unknown"}`,
    replyLeadId,
    selectedIds,
    attachments,
    "",
    message.content
  ]
    .filter((line) => line !== "")
    .join("\n");
}

function createCrmOrchestratorJsonSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["intent", "reasoning", "action", "status", "message"],
    properties: {
      intent: {
        type: "string",
        enum: ["START_NEW_LEAD_SESSION", "CREATE_LEAD", "UPDATE_LEAD", "SEARCH_LEAD", "CREATE_REMINDER", "SUPPORT_REQUEST", "CLARIFICATION_REQUIRED"]
      },
      reasoning: { type: "string" },
      action: {
        type: "string",
        enum: ["New Lead Session Agent", "Lead Creation Agent", "Lead Update Agent", "Lead Search Agent", "Reminder Agent", "Support Agent", "clarification"]
      },
      status: {
        type: "string",
        enum: ["ready", "need_clarification"]
      },
      message: { type: "string" }
    }
  };
}

function normalizeCrmOrchestratorDecision(value: unknown): CrmOrchestratorDecision {
  if (!value || typeof value !== "object") {
    throw new Error("OpenAI CRM orchestrator returned invalid JSON");
  }

  const record = value as Record<string, unknown>;
  const intent = normalizeIntent(record.intent);
  const status = normalizeStatus(record.status);
  const action = normalizeAction(record.action, status);

  return {
    intent,
    reasoning: typeof record.reasoning === "string" ? record.reasoning : "",
    action,
    status,
    message: typeof record.message === "string" ? record.message : "I need one more detail before I can route this."
  };
}

function normalizeIntent(value: unknown): CrmOrchestratorIntent {
  const allowed: CrmOrchestratorIntent[] = [
    "START_NEW_LEAD_SESSION",
    "CREATE_LEAD",
    "UPDATE_LEAD",
    "SEARCH_LEAD",
    "CREATE_REMINDER",
    "SUPPORT_REQUEST",
    "CLARIFICATION_REQUIRED"
  ];
  return allowed.includes(value as CrmOrchestratorIntent) ? (value as CrmOrchestratorIntent) : "CLARIFICATION_REQUIRED";
}

function normalizeStatus(value: unknown): CrmOrchestratorStatus {
  return value === "ready" ? "ready" : "need_clarification";
}

function normalizeAction(value: unknown, status: CrmOrchestratorStatus): CrmOrchestratorDecision["action"] {
  if (status === "need_clarification") {
    return "clarification";
  }

  const allowed: Array<Exclude<CrmOrchestratorDecision["action"], "clarification">> = [
    "New Lead Session Agent",
    "Lead Creation Agent",
    "Lead Update Agent",
    "Lead Search Agent",
    "Reminder Agent",
    "Support Agent"
  ];
  return allowed.includes(value as never) ? (value as Exclude<CrmOrchestratorDecision["action"], "clarification">) : "Lead Search Agent";
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
