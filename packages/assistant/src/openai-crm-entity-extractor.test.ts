import { describe, expect, it } from "vitest";
import { createOpenAiCrmEntityExtractor } from "./openai-crm-entity-extractor";

describe("openai crm entity extractor", () => {
  it("posts prompt, model, message context, and schema to Responses API", async () => {
    const calls: unknown[] = [];
    const extractor = createOpenAiCrmEntityExtractor({
      apiKey: "test-key",
      model: "gpt-5.2",
      prompt: "Extract CRM entities.",
      fetchImpl: async (_url, init) => {
        calls.push(JSON.parse(String(init?.body)));
        return new Response(
          JSON.stringify({
            output_text: JSON.stringify({
              facts: [],
              events: [],
              followups: [
                {
                  type: "FOLLOW_UP",
                  label: "Call Artem",
                  value: "Call Artem",
                  title: "Call Artem",
                  dueAt: null,
                  recurrence: "none",
                  assigneeHint: null,
                  sourceText: "call Artem",
                  confidence: "high"
                }
              ],
              people: [{ type: "PERSON", label: "Artem", value: "Artem", sourceText: "call Artem", confidence: "high" }],
              organizations: [],
              tags: [],
              leadNaming: { displayName: null, projectPlace: null, language: null, country: null },
              confidence: { overall: "high" },
              summary: "User asked to call Artem."
            })
          }),
          { status: 200 }
        );
      }
    });

    const result = await extractor.extract({
      channel: "telegram",
      workspaceId: "workspace-1",
      messageId: "message-1",
      leadId: "L-2026-001",
      text: "call Artem",
      receivedAt: "2026-06-02T10:00:00.000Z",
      attachments: []
    });

    expect(result.followups[0]?.title).toBe("Call Artem");
    expect(JSON.stringify(calls[0])).toContain("Extract CRM entities.");
    expect(JSON.stringify(calls[0])).toContain("gpt-5.2");
    expect(JSON.stringify(calls[0])).toContain("crm_entity_extraction");
    expect(JSON.stringify(calls[0])).toContain("L-2026-001");
  });
});
