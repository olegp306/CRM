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
  it("answers help commands with the shared channel engine without calling OpenAI", async () => {
    const fetchMock = vi.fn<OpenAIAssistantFetch>();

    const result = await createOpenAIAssistantSubmissionResult(
      {
        context: { ...baseContext, route: "/leads", module: "leads" },
        content: "/help",
        threadId: "thread-help-command",
        messageId: "message-help-command"
      },
      {
        apiKey: "",
        model: "gpt-test",
        fetch: fetchMock
      }
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.response).toContain("I can create and update leads");
    expect(result.feedback).toBeNull();
    expect(result.actionPreview).toBeNull();
  });

  it("routes source-material uploads through the shared channel engine without calling OpenAI", async () => {
    const fetchMock = vi.fn<OpenAIAssistantFetch>();

    const result = await createOpenAIAssistantSubmissionResult(
      {
        context: { ...baseContext, route: "/leads", module: "leads" },
        content: "Please review this client request",
        threadId: "thread-source-upload",
        messageId: "message-source-upload",
        attachments: [
          {
            id: "attachment-1",
            kind: "pdf",
            fileName: "brief.pdf",
            mimeType: "application/pdf",
            base64: "JVBERi0x"
          }
        ]
      },
      {
        apiKey: "",
        model: "gpt-test",
        fetch: fetchMock
      }
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.response).toContain("I can create a lead from this source material");
    expect(result.actionPreview).toMatchObject({
      actionType: "create_lead",
      summary: "Create lead from assistant source material"
    });
    expect(result.responseButtons).toEqual([{ label: "Create lead", action: "confirm" }]);
  });

  it("requires an OpenAI API key only when a model call is needed", async () => {
    await expect(
      createOpenAIAssistantSubmissionResult(
        {
          context: baseContext,
          content: "Create lead Anna Beispiel, BGF 150",
          threadId: "thread-needs-openai",
          messageId: "message-needs-openai"
        },
        {
          apiKey: "",
          model: "gpt-test",
          fetch: vi.fn<OpenAIAssistantFetch>()
        }
      )
    ).rejects.toThrow("OPENAI_API_KEY is required for the assistant runtime.");
  });

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
    expect(result.responseButtons).toEqual([
      { label: "Confirm", action: "confirm" },
      { label: "Cancel", action: "cancel" }
    ]);
  });

  it("routes source-material uploads to lead intake even when OpenAI returns a create lead action", async () => {
    const fetchMock = vi.fn<OpenAIAssistantFetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  response: "I prepared a lead creation preview.",
                  action: {
                    actionType: "create_lead",
                    summary: "Create lead from upload",
                    sourceText: "Create lead Anna Beispiel from this source material"
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
        context: { ...baseContext, route: "/leads", module: "leads" },
        content: "Create lead Anna Beispiel from this source material",
        threadId: "thread-source-upload",
        messageId: "message-source-upload",
        attachments: [
          {
            id: "attachment-1",
            kind: "pdf",
            fileName: "brief.pdf",
            mimeType: "application/pdf",
            base64: "JVBERi0x"
          }
        ]
      },
      {
        apiKey: "test-key",
        model: "gpt-test",
        fetch: fetchMock
      }
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.response).toContain("I can create a lead from this source material");
    expect(result.actionPreview).toMatchObject({
      actionType: "create_lead",
      summary: "Create lead from assistant source material",
      changes: [
        {
          field: "lead.sourceText",
          from: null,
          to: "Create lead Anna Beispiel from this source material\nWeb attachment 1: PDF (brief.pdf)"
        }
      ]
    });
    expect(result.confirmationStatus).toBe("awaiting_confirmation");
    expect(result.feedback).toBeNull();
    expect(result.responseButtons).toEqual([{ label: "Create lead", action: "confirm" }]);
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

  it("answers selected KP-ready lead questions without calling OpenAI", async () => {
    const fetchMock = vi.fn<OpenAIAssistantFetch>();

    const result = await createOpenAIAssistantSubmissionResult(
      {
        context: { ...baseContext, route: "/leads", module: "leads", selectedRecordIds: ["L-2026-004"] },
        content: "Is KP ready?",
        threadId: "thread-selected-kp-ready",
        messageId: "message-selected-kp-ready",
        lead: {
          leadId: "L-2026-004",
          missingFields: [],
          kpReady: true,
          pdfUrl: "/documents/attachments/pdf-1",
          docxUrl: "/documents/attachments/docx-1?download=1",
          canSendKp: true
        }
      },
      {
        apiKey: "",
        model: "gpt-test",
        fetch: fetchMock
      }
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.response).toContain("has enough data for KP");
    expect(result.responseButtons.map((button) => button.label)).toEqual(["CRM", "PDF", "DOC", "Send KP", "Mark KP sent"]);
  });

  it("uses the CRM orchestrator client for ambiguous web CRM routing before the generic OpenAI planner", async () => {
    const fetchMock = vi.fn<OpenAIAssistantFetch>();
    const crmOrchestrator = {
      route: vi.fn(async () => ({
        intent: "SEARCH_LEAD" as const,
        reasoning: "The user asks to pull up an existing person.",
        action: "Lead Search Agent" as const,
        status: "ready" as const,
        message: "I will search for that lead."
      }))
    };

    const result = await createOpenAIAssistantSubmissionResult(
      {
        context: { ...baseContext, route: "/leads", module: "assistant" },
        content: "Can you pull up what we know about the person from yesterday?",
        threadId: "thread-web-crm-orchestrator",
        messageId: "message-web-crm-orchestrator"
      },
      {
        apiKey: "test-key",
        model: "gpt-test",
        fetch: fetchMock,
        crmOrchestrator
      }
    );

    expect(crmOrchestrator.route).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "web",
        content: "Can you pull up what we know about the person from yesterday?"
      })
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.response).toContain("Lead Search Agent");
    expect(result.actionPreview).toBeNull();
    expect(result.feedback).toBeNull();
  });

  it("uses CRM orchestrator clarification for ambiguous web requests instead of the generic OpenAI planner", async () => {
    const fetchMock = vi.fn<OpenAIAssistantFetch>();
    const crmOrchestrator = {
      route: vi.fn(async () => ({
        intent: "CLARIFICATION_REQUIRED" as const,
        reasoning: "The target CRM action is unclear.",
        action: "clarification" as const,
        status: "need_clarification" as const,
        message: "Do you want me to create a new lead or update an existing one?"
      }))
    };

    const result = await createOpenAIAssistantSubmissionResult(
      {
        context: { ...baseContext, route: "/leads", module: "assistant" },
        content: "Let's do that thing for the client",
        threadId: "thread-web-crm-clarification",
        messageId: "message-web-crm-clarification"
      },
      {
        apiKey: "test-key",
        model: "gpt-test",
        fetch: fetchMock,
        crmOrchestrator
      }
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.response).toBe("Do you want me to create a new lead or update an existing one?");
    expect(result.actionPreview).toBeNull();
  });

  it("keeps web source-material uploads on lead intake without CRM orchestrator routing", async () => {
    const fetchMock = vi.fn<OpenAIAssistantFetch>();
    const crmOrchestrator = {
      route: vi.fn()
    };

    const result = await createOpenAIAssistantSubmissionResult(
      {
        context: { ...baseContext, route: "/leads", module: "assistant" },
        content: "Please review this source material and create a lead if the data is sufficient.",
        threadId: "thread-web-source-material",
        messageId: "message-web-source-material",
        attachments: [
          {
            id: "attachment-1",
            kind: "pdf",
            fileName: "brief.pdf",
            mimeType: "application/pdf",
            base64: "JVBERi0x"
          }
        ]
      },
      {
        apiKey: "test-key",
        model: "gpt-test",
        fetch: fetchMock,
        crmOrchestrator
      }
    );

    expect(crmOrchestrator.route).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.actionPreview).toMatchObject({
      actionType: "create_lead",
      summary: "Create lead from assistant source material"
    });
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

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.feedback).toBeNull();
    expect(result.actionPreview).toMatchObject({
      actionType: "create_lead",
      summary: "Create lead from assistant source material"
    });
    expect(result.confirmationStatus).toBe("awaiting_confirmation");
    expect(result.responseButtons).toEqual([{ label: "Create lead", action: "confirm" }]);
  });
});
