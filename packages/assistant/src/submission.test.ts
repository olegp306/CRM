import { describe, expect, it } from "vitest";
import type { AssistantContext } from "./context";
import { createAssistantSubmissionResult, enrichLeadIntakeSubmissionResult } from "./submission";

const baseContext: AssistantContext = {
  workspaceId: "workspace-1",
  userId: "user-1",
  role: "admin",
  route: "/leads",
  module: "leads",
  selectedRecordIds: []
};

describe("assistant submission orchestration", () => {
  it("creates a thread and message draft from trimmed user text", () => {
    const result = createAssistantSubmissionResult({
      context: baseContext,
      content: "  Help me create a lead for Anna Beispiel  ",
      threadId: "thread-1",
      messageId: "message-1"
    });

    expect(result.thread).toEqual({
      workspaceId: "workspace-1",
      createdByUserId: "user-1",
      title: "Help me create a lead for Anna Beispiel"
    });
    expect(result.message.content).toBe("Help me create a lead for Anna Beispiel");
    expect(result.message.intent).toBe("crm_action");
  });

  it("creates feedback drafts for product signal intents", () => {
    const result = createAssistantSubmissionResult({
      context: { ...baseContext, module: "assistant" },
      content: "Please add a better mobile table layout",
      threadId: "thread-2",
      messageId: "message-2"
    });

    expect(result.feedback).toEqual({
      workspaceId: "workspace-1",
      sourceThreadId: "thread-2",
      sourceMessageId: "message-2",
      type: "feature_request",
      status: "new",
      priority: "normal",
      moduleContext: "assistant",
      role: "admin",
      appVersion: "0.3.3"
    });
    expect(result.response).toBe("I saved this as product feedback for review.");
  });

  it("previews create lead actions for owner and admin roles", () => {
    const result = createAssistantSubmissionResult({
      context: baseContext,
      content: "Create lead Anna Beispiel",
      threadId: "thread-3",
      messageId: "message-3"
    });

    expect(result.actionPreview).toMatchObject({
      actionType: "create_lead",
      summary: "Create lead from assistant request",
      requiresConfirmation: true
    });
    expect(result.confirmationStatus).toBe("awaiting_confirmation");
    expect(result.response).toBe("I prepared a create lead preview. Confirm before I execute it.");
    expect(result.responseButtons).toEqual([
      { label: "Confirm", action: "confirm" },
      { label: "Cancel", action: "cancel" }
    ]);
  });

  it("routes source-material uploads to lead intake before create lead previews", () => {
    const result = createAssistantSubmissionResult({
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
    });

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

  it("routes clear source-material intake text to lead intake before create lead previews", () => {
    const result = createAssistantSubmissionResult({
      context: { ...baseContext, route: "/leads", module: "leads" },
      content: "Create a lead from this client request with address and BGF",
      threadId: "thread-source-text",
      messageId: "message-source-text"
    });

    expect(result.response).toContain("I can create a lead from this source material");
    expect(result.actionPreview).toMatchObject({
      actionType: "create_lead",
      summary: "Create lead from assistant source material",
      changes: [{ field: "lead.sourceText", from: null, to: "Create a lead from this client request with address and BGF" }]
    });
    expect(result.confirmationStatus).toBe("awaiting_confirmation");
    expect(result.feedback).toBeNull();
    expect(result.responseButtons).toEqual([{ label: "Create lead", action: "confirm" }]);
  });

  it("keeps attachment-only source references in the lead preview", () => {
    const result = createAssistantSubmissionResult({
      context: { ...baseContext, route: "/leads", module: "leads" },
      content: "Please review this source material and create a lead if the data is sufficient.",
      threadId: "thread-source-only",
      messageId: "message-source-only",
      attachments: [
        {
          id: "attachment-1",
          kind: "photo",
          fileName: "site.jpg",
          mimeType: "image/jpeg",
          base64: "abcd"
        }
      ]
    });

    expect(result.actionPreview).toMatchObject({
      actionType: "create_lead",
      changes: [
        {
          field: "lead.sourceText",
          from: null,
          to: "Please review this source material and create a lead if the data is sufficient.\nWeb attachment 1: PHOTO (site.jpg)"
        }
      ]
    });
  });

  it("enriches web lead-intake previews with parsed fields before confirmation", async () => {
    const result = createAssistantSubmissionResult({
      context: { ...baseContext, route: "/leads", module: "leads" },
      content: "Please review this source material and create a lead if the data is sufficient.",
      threadId: "thread-parsed-source",
      messageId: "message-parsed-source",
      attachments: [
        {
          id: "attachment-photo",
          kind: "photo",
          fileName: "brief.jpg",
          mimeType: "image/jpeg",
          base64: "abcd"
        }
      ]
    });

    const enriched = await enrichLeadIntakeSubmissionResult(result, {
      context: { ...baseContext, route: "/leads", module: "leads" },
      content: "Please review this source material and create a lead if the data is sufficient.",
      threadId: "thread-parsed-source",
      messageId: "message-parsed-source",
      attachments: [
        {
          id: "attachment-photo",
          kind: "photo",
          fileName: "brief.jpg",
          mimeType: "image/jpeg",
          base64: "abcd"
        }
      ]
    }, {
      async parseLead(input) {
        expect(input.attachments?.[0]?.fileName).toBe("brief.jpg");
        return {
          clientName: "Irina Schneider",
          requestType: "new_build",
          urgency: "medium",
          temperature: "warm",
          bgfM2: 195,
          projectAddress: "Bad Aibling, Gartenweg 9",
          email: "irina.schneider@example.com",
          phone: "+49 160 4442211",
          missingData: [],
          summary: "Ready Neubau EFH lead",
          suggestedReply: "I can prepare the KP."
        };
      }
    });

    expect(enriched.actionPreview?.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "lead.clientName", to: "Irina Schneider" }),
        expect.objectContaining({ field: "lead.requestType", to: "new_build" }),
        expect.objectContaining({ field: "lead.projectAddress", to: "Bad Aibling, Gartenweg 9" }),
        expect.objectContaining({ field: "lead.bgfM2", to: 195 }),
        expect.objectContaining({ field: "lead.email", to: "irina.schneider@example.com" }),
        expect.objectContaining({ field: "lead.phone", to: "+49 160 4442211" }),
        expect.objectContaining({ field: "lead.temperature", to: "warm" }),
        expect.objectContaining({ field: "lead.missingData", to: [] })
      ])
    );
    expect(enriched.actionPreview?.changes.find((change) => change.field === "lead.sourceText")?.to).toContain(
      "Summary: Ready Neubau EFH lead"
    );
  });

  it("enriches web lead-update previews with parsed fields before confirmation", async () => {
    const input = {
      context: { ...baseContext, route: "/leads", module: "leads", selectedRecordIds: ["L-2026-004"] },
      content: "Add this to the selected lead: updated BGF 210 m2 and email irina@example.com.",
      threadId: "thread-update-enrich",
      messageId: "message-update-enrich"
    } satisfies Parameters<typeof createAssistantSubmissionResult>[0];
    const result = createAssistantSubmissionResult(input);

    const enriched = await enrichLeadIntakeSubmissionResult(result, input, {
      parseLead: async () => ({
        clientName: "Irina Schneider",
        requestType: "new_build",
        urgency: "medium",
        temperature: "warm",
        bgfM2: 210,
        projectAddress: "Bad Aibling",
        email: "irina@example.com",
        phone: null,
        missingData: ["projectAddress"],
        summary: "Updated lead fields",
        suggestedReply: "Updated."
      })
    });

    expect(enriched.actionPreview).toMatchObject({
      actionType: "update_lead",
      summary: "Update selected lead from assistant source material",
      changes: [
        { field: "lead.selectedRecordIds", from: null, to: ["L-2026-004"] },
        { field: "lead.sourceText", from: null, to: expect.stringContaining("Summary: Updated lead fields") },
        { field: "lead.clientName", from: null, to: "Irina Schneider" },
        { field: "lead.requestType", from: null, to: "new_build" },
        { field: "lead.projectAddress", from: null, to: "Bad Aibling" },
        { field: "lead.bgfM2", from: null, to: 210 },
        { field: "lead.email", from: null, to: "irina@example.com" },
        { field: "lead.phone", from: null, to: null },
        { field: "lead.missingData", from: null, to: ["projectAddress"] },
        { field: "lead.isStandard", from: null, to: true },
        { field: "lead.temperature", from: null, to: "warm" }
      ]
    });
  });

  it("keeps standalone reminder requests out of generic assistant write actions", () => {
    const result = createAssistantSubmissionResult({
      context: baseContext,
      content: "Schedule follow-up for lead L-2026-001 tomorrow",
      threadId: "thread-5",
      messageId: "message-5"
    });

    expect(result.actionPreview).toBeNull();
    expect(result.confirmationStatus).toBeNull();
    expect(result.response).toContain("Scheduled this reminder on lead L-2026-001");
    expect(result.response).toContain("09:00");
    expect(result.response).toContain("Google Calendar sync is not connected yet");
    expect(result.responseButtons).toEqual([{ label: "CRM", url: "/leads?leadId=L-2026-001" }]);
  });

  it("stores selected-lead follow-up requests as lead history without standalone actions", () => {
    const result = createAssistantSubmissionResult({
      context: { ...baseContext, route: "/leads", module: "leads", selectedRecordIds: ["L-2026-001"] },
      content: "Remind me tomorrow to check this lead LinkedIn",
      threadId: "thread-selected-followup",
      messageId: "message-selected-followup"
    });

    expect(result.actionPreview).toBeNull();
    expect(result.confirmationStatus).toBeNull();
    expect(result.response).toContain("Scheduled this reminder on lead L-2026-001");
    expect(result.response).toContain("09:00");
    expect(result.response).toContain("Google Calendar sync is not connected yet");
    expect(result.responseButtons).toEqual([{ label: "CRM", url: "/leads?leadId=L-2026-001" }]);
  });

  it("keeps selected-lead reminders from creating lead drafts", () => {
    const result = createAssistantSubmissionResult({
      context: { ...baseContext, route: "/leads", module: "leads", selectedRecordIds: ["L-2026-001"] },
      content: "Remind me tomorrow to send a short note to this client",
      threadId: "thread-natural-followup",
      messageId: "message-natural-followup"
    });

    expect(result.actionPreview).toBeNull();
    expect(result.actionPreview?.actionType).not.toBe("create_lead");
    expect(result.response).toContain("Scheduled this reminder on lead L-2026-001");
    expect(result.response).toContain("09:00");
    expect(result.response).toContain("Google Calendar sync is not connected yet");
  });

  it("keeps project task updates out of generic assistant write actions", () => {
    const result = createAssistantSubmissionResult({
      context: { ...baseContext, route: "/projects", module: "projects", selectedRecordIds: ["P-2026-001"] },
      content: "Update project task permit package to done",
      threadId: "thread-6",
      messageId: "message-6"
    });

    expect(result.actionPreview).toBeNull();
    expect(result.confirmationStatus).toBeNull();
    expect(result.response).toContain("Right now I can create or update leads");
    expect(result.responseButtons).toEqual([]);
  });

  it("keeps KP generation requests out of generic assistant write actions", () => {
    const result = createAssistantSubmissionResult({
      context: { ...baseContext, route: "/documents", module: "documents", selectedRecordIds: ["L-2026-001"] },
      content: "Generate KP for lead L-2026-001",
      threadId: "thread-7",
      messageId: "message-7"
    });

    expect(result.actionPreview).toBeNull();
    expect(result.confirmationStatus).toBeNull();
    expect(result.response).toContain("Right now I can create or update leads");
    expect(result.responseButtons).toEqual([]);
  });

  it("keeps typed KP sent requests out of generic assistant write actions", () => {
    const result = createAssistantSubmissionResult({
      context: { ...baseContext, selectedRecordIds: ["L-2026-001"] },
      content: "Mark KP sent for this lead",
      threadId: "thread-8",
      messageId: "message-8"
    });

    expect(result.actionPreview).toBeNull();
    expect(result.confirmationStatus).toBeNull();
    expect(result.response).toContain("Right now I can create or update leads");
  });

  it("keeps typed KP sent undo requests out of generic assistant write actions", () => {
    const result = createAssistantSubmissionResult({
      context: { ...baseContext, selectedRecordIds: ["L-2026-001"] },
      content: "Undo KP sent for this lead",
      threadId: "thread-undo-kp",
      messageId: "message-undo-kp"
    });

    expect(result.actionPreview).toBeNull();
    expect(result.confirmationStatus).toBeNull();
    expect(result.response).toContain("Right now I can create or update leads");
    expect(result.responseButtons).toEqual([]);
  });
  it("blocks action mode for roles without permission and creates permission feedback", () => {
    const result = createAssistantSubmissionResult({
      context: { ...baseContext, role: "viewer" },
      content: "Create lead Anna Beispiel",
      threadId: "thread-4",
      messageId: "message-4"
    });

    expect(result.actionPreview).toBeNull();
    expect(result.permissionBlocked?.feedbackType).toBe("permission_blocked");
    expect(result.feedback?.type).toBe("permission_blocked");
    expect(result.confirmationStatus).toBe("cancelled");
  });

  it("answers assistant identity questions without creating feedback", () => {
    const result = createAssistantSubmissionResult({
      context: { ...baseContext, route: "/leads", module: "leads" },
      content: "Кто ты и что умеешь?",
      threadId: "thread-help",
      messageId: "message-help"
    });

    expect(result.response).toContain("I can create and update leads");
    expect(result.feedback).toBeNull();
    expect(result.actionPreview).toBeNull();
  });

  it("answers CSV and Excel table export requests with a download button", () => {
    const result = createAssistantSubmissionResult({
      context: { ...baseContext, route: "/leads", module: "leads" },
      content: "Скинь мне Excel таблицу лидов",
      threadId: "thread-csv-export",
      messageId: "message-csv-export"
    });

    expect(result.feedback).toBeNull();
    expect(result.actionPreview).toBeNull();
    expect(result.response).toContain("CSV");
    expect(result.responseButtons).toEqual([
      { label: "Download CSV", action: "download_csv", url: "/exports/leads" }
    ]);
  });

  it("answers selected KP-ready lead questions with shared lead actions", () => {
    const result = createAssistantSubmissionResult({
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
    });

    expect(result.response).toContain("has enough data for KP");
    expect(result.actionPreview).toMatchObject({
      actionType: "mark_kp_sent",
      summary: "Mark KP sent from selected lead",
      changes: [
        { field: "lead.selectedRecordIds", from: null, to: ["L-2026-004"] },
        { field: "lead.sourceText", from: null, to: "Is KP ready?" }
      ]
    });
    expect(result.confirmationStatus).toBe("awaiting_confirmation");
    expect(result.responseButtons).toEqual([
      { label: "CRM", action: "open_crm", url: "/leads?leadId=L-2026-004" },
      { label: "PDF", action: "open_pdf", url: "/documents/attachments/pdf-1" },
      { label: "DOC", action: "download_doc", url: "/documents/attachments/docx-1?download=1" },
      { label: "Send KP", action: "send_kp", url: "mailto:?subject=KP%20L-2026-004" },
      { label: "Mark KP sent", action: "mark_kp_sent" }
    ]);
  });

  it("previews selected lead updates from web source material", () => {
    const result = createAssistantSubmissionResult({
      context: { ...baseContext, route: "/leads", module: "leads", selectedRecordIds: ["L-2026-004"] },
      content: "Add this to the selected lead: client sent updated BGF 210 m2 and budget 42000 EUR.",
      threadId: "thread-selected-lead-update",
      messageId: "message-selected-lead-update"
    });

    expect(result.response).toContain("I can update this lead L-2026-004");
    expect(result.actionPreview).toMatchObject({
      actionType: "update_lead",
      summary: "Update selected lead from assistant source material",
      changes: [
        { field: "lead.selectedRecordIds", from: null, to: ["L-2026-004"] },
        {
          field: "lead.sourceText",
          from: null,
          to: "Add this to the selected lead: client sent updated BGF 210 m2 and budget 42000 EUR."
        }
      ]
    });
    expect(result.confirmationStatus).toBe("awaiting_confirmation");
    expect(result.responseButtons).toEqual([
      { label: "CRM", action: "open_crm", url: "/leads?leadId=L-2026-004" },
      { label: "Update lead", action: "confirm" }
    ]);
  });

  it("keeps source-material uploads in assistant context without creating feature feedback", () => {
    const result = createAssistantSubmissionResult({
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
    });

    expect(result.feedback).toBeNull();
  });
});
