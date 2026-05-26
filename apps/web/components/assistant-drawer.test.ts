import { describe, expect, it } from "vitest";
import { getAssistantExecutionButtons, getAssistantExecutionLabel } from "./assistant-execution-label";

describe("getAssistantExecutionLabel", () => {
  it("shows lead ids for lead executions", () => {
    expect(getAssistantExecutionLabel({ status: "executed", leadId: "L-2026-002", recordId: "lead-record-1" })).toBe(
      "L-2026-002"
    );
  });

  it("shows follow-up ids for follow-up executions", () => {
    expect(
      getAssistantExecutionLabel({
        status: "executed",
        actionType: "schedule_followup",
        followupId: "F-20260521-message-2",
        recordId: "followup-record-1"
      })
    ).toBe("F-20260521-message-2");
  });

  it("shows task update ids for project task executions", () => {
    expect(
      getAssistantExecutionLabel({
        status: "executed",
        actionType: "update_project_task",
        taskUpdateId: "T-20260521-message-3",
        recordId: "task-update-record-1"
      })
    ).toBe("T-20260521-message-3");
  });

  it("shows document ids for KP generation executions", () => {
    expect(
      getAssistantExecutionLabel({
        status: "executed",
        actionType: "generate_kp",
        documentId: "D-20260521-message-4",
        recordId: "generated-document-record-1"
      })
    ).toBe("D-20260521-message-4");
  });
});

describe("getAssistantExecutionButtons", () => {
  it("creates a Telegram-style CRM deep link after lead creation", () => {
    expect(
      getAssistantExecutionButtons({
        status: "executed",
        leadId: "L-2026-002",
        recordId: "lead-record-1",
        pdfAttachmentId: "attachment-pdf",
        docxAttachmentId: "attachment-docx"
      })
    ).toEqual([
      { label: "CRM", url: "/leads?leadId=L-2026-002" },
      { label: "PDF", url: "/documents/attachments/attachment-pdf" },
      { label: "DOC", url: "/documents/attachments/attachment-docx?download=1" }
    ]);
  });

  it("does not create CRM buttons for non-lead executions", () => {
    expect(
      getAssistantExecutionButtons({
        status: "executed",
        actionType: "generate_kp",
        documentId: "D-20260521-message-4",
        recordId: "generated-document-record-1"
      })
    ).toEqual([]);
  });
});
