import { describe, expect, it } from "vitest";
import { createLeadChatActionButtons, createLeadChatActions } from "./lead-action-orchestrator";

describe("lead action orchestrator", () => {
  it("returns all normalized actions for a KP-ready lead", () => {
    const actions = createLeadChatActions({
      leadId: "L-2026-011",
      kpReady: true,
      pdfUrl: "/documents/attachments/pdf-1",
      docxUrl: "/documents/attachments/docx-1?download=1",
      canSendKp: true,
      clientEmail: "client@example.com"
    });

    expect(actions).toEqual([
      { type: "open_crm", leadId: "L-2026-011", url: "/leads?leadId=L-2026-011" },
      { type: "open_pdf", leadId: "L-2026-011", url: "/documents/attachments/pdf-1" },
      { type: "download_doc", leadId: "L-2026-011", url: "/documents/attachments/docx-1?download=1" },
      { type: "send_kp", leadId: "L-2026-011", mailtoUrl: "mailto:client@example.com?subject=KP%20L-2026-011" },
      { type: "mark_kp_sent", leadId: "L-2026-011" }
    ]);
  });

  it("adds undo after KP was marked as sent", () => {
    const actions = createLeadChatActions({
      leadId: "L-2026-012",
      kpReady: true,
      canSendKp: true,
      kpSent: true
    });

    expect(actions.map((action) => action.type)).toEqual(["open_crm", "send_kp", "mark_kp_sent", "undo_kp_sent"]);
  });

  it("does not enable Send KP or Mark KP sent when required fields are missing", () => {
    const actions = createLeadChatActions({
      leadId: "L-2026-013",
      kpReady: false,
      missingFields: ["projectAddress"],
      pdfUrl: "/documents/attachments/pdf-2",
      docxUrl: "/documents/attachments/docx-2?download=1",
      canSendKp: true
    });

    expect(actions.map((action) => action.type)).toEqual(["open_crm", "open_pdf", "download_doc"]);
  });

  it("uses absolute CRM links when a channel adapter provides a base URL", () => {
    const actions = createLeadChatActions(
      {
        leadId: "L-2026-014",
        kpReady: true
      },
      { crmBaseUrl: "https://crm.example.com/" }
    );

    expect(actions[0]).toEqual({ type: "open_crm", leadId: "L-2026-014", url: "https://crm.example.com/leads?leadId=L-2026-014" });
  });

  it("renders Web and Telegram button labels from the same normalized action list", () => {
    const actions = createLeadChatActions({
      leadId: "L-2026-015",
      kpReady: true,
      pdfUrl: "https://crm.example.com/documents/attachments/pdf-3",
      docxUrl: "https://crm.example.com/documents/attachments/docx-3?download=1",
      canSendKp: true,
      kpSent: true
    });

    expect(createLeadChatActionButtons(actions)).toEqual([
      { label: "CRM", action: "open_crm", url: "/leads?leadId=L-2026-015" },
      { label: "PDF", action: "open_pdf", url: "https://crm.example.com/documents/attachments/pdf-3" },
      { label: "DOC", action: "download_doc", url: "https://crm.example.com/documents/attachments/docx-3?download=1" },
      { label: "Send KP", action: "send_kp", url: "mailto:?subject=KP%20L-2026-015" },
      { label: "Mark KP sent", action: "mark_kp_sent" },
      { label: "Undo", action: "undo_kp_sent" }
    ]);
  });
});
