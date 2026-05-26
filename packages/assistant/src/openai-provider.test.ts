import { describe, expect, it, vi } from "vitest";
import type { AssistantContext } from "./context";
import { createOpenAIAssistantSubmissionResult, type OpenAIAssistantFetch } from "./openai-provider";

const baseContext: AssistantContext = {
  workspaceId: "workspace-1",
  userId: "user-1",
  role: "admin",
  route: "/leads",
  module: "leads",
  selectedRecordIds: []
};

describe("createOpenAIAssistantSubmissionResult", () => {
  it("uses OpenAI to produce a create lead preview", async () => {
    const fetchMock = vi.fn<OpenAIAssistantFetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  response: "I prepared a lead creation preview for Anna Beispiel.",
                  action: {
                    actionType: "create_lead",
                    summary: "Create lead for Anna Beispiel",
                    sourceText: "Create lead Anna Beispiel, BGF 150"
                  }
                })
              }
            }
          ]
        }),
        { status: 200 }
      )
    );

    const result = await createOpenAIAssistantSubmissionResult(
      {
        context: baseContext,
        content: "Create lead Anna Beispiel, BGF 150",
        threadId: "thread-1",
        messageId: "message-1"
      },
      {
        apiKey: "test-key",
        model: "gpt-test",
        fetch: fetchMock
      }
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer test-key",
          "content-type": "application/json"
        })
      })
    );
    expect(result.response).toBe("I prepared a lead creation preview for Anna Beispiel.");
    expect(result.actionPreview).toMatchObject({
      actionType: "create_lead",
      summary: "Create lead for Anna Beispiel",
      changes: [{ field: "lead.sourceText", from: null, to: "Create lead Anna Beispiel, BGF 150" }]
    });
    expect(result.confirmationStatus).toBe("awaiting_confirmation");
  });

  it("blocks OpenAI-requested actions when the user role lacks permission", async () => {
    const fetchMock = vi.fn<OpenAIAssistantFetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  response: "I can create this lead.",
                  action: {
                    actionType: "create_lead",
                    summary: "Create lead",
                    sourceText: "Create lead Anna Beispiel"
                  }
                })
              }
            }
          ]
        }),
        { status: 200 }
      )
    );

    const result = await createOpenAIAssistantSubmissionResult(
      {
        context: { ...baseContext, role: "viewer" },
        content: "Create lead Anna Beispiel",
        threadId: "thread-2",
        messageId: "message-2"
      },
      {
        apiKey: "test-key",
        model: "gpt-test",
        fetch: fetchMock
      }
    );

    expect(result.actionPreview).toBeNull();
    expect(result.permissionBlocked?.feedbackType).toBe("permission_blocked");
    expect(result.feedback?.type).toBe("permission_blocked");
    expect(result.confirmationStatus).toBe("cancelled");
  });

  it("answers assistant identity questions without persisting feedback", async () => {
    const fetchMock = vi.fn<OpenAIAssistantFetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  response: "I can answer CRM questions.",
                  action: null
                })
              }
            }
          ]
        }),
        { status: 200 }
      )
    );

    const result = await createOpenAIAssistantSubmissionResult(
      {
        context: { ...baseContext, route: "/leads", module: "leads" },
        content: "Кто ты и что умеешь?",
        threadId: "thread-help",
        messageId: "message-help"
      },
      {
        apiKey: "test-key",
        model: "gpt-test",
        fetch: fetchMock
      }
    );

    expect(result.response).toContain("I can create and update leads");
    expect(result.feedback).toBeNull();
    expect(result.actionPreview).toBeNull();
    expect(result.confirmationStatus).toBeNull();
  });

  it("accepts source-material uploads without persisting feature feedback when OpenAI returns no action", async () => {
    const fetchMock = vi.fn<OpenAIAssistantFetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  response: "I can review the uploaded source material.",
                  action: null
                })
              }
            }
          ]
        }),
        { status: 200 }
      )
    );

    const result = await createOpenAIAssistantSubmissionResult(
      {
        context: { ...baseContext, route: "/leads", module: "leads" },
        content: "Проверь этот план и создай лид, если данных хватает",
        threadId: "thread-upload",
        messageId: "message-upload",
        attachments: [
          {
            id: "attachment-1",
            kind: "photo",
            fileName: "site.jpg",
            mimeType: "image/jpeg",
            base64: "abcd"
          }
        ]
      },
      {
        apiKey: "test-key",
        model: "gpt-test",
        fetch: fetchMock
      }
    );

    const [, requestInit] = fetchMock.mock.calls[0] ?? [];
    const requestBody = JSON.parse(String(requestInit?.body)) as { messages: Array<{ role: string; content: string }> };
    const userPayload = JSON.parse(requestBody.messages.find((message) => message.role === "user")?.content ?? "{}") as {
      attachments?: Array<{ fileName?: string; kind?: string; mimeType?: string }>;
    };

    expect(userPayload.attachments).toEqual([
      expect.objectContaining({
        fileName: "site.jpg",
        kind: "photo",
        mimeType: "image/jpeg"
      })
    ]);
    expect(result.feedback).toBeNull();
    expect(result.actionPreview).toBeNull();
    expect(result.confirmationStatus).toBeNull();
  });
});
