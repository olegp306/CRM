import { describe, expect, it } from "vitest";
import type { CreatedLeadRecord, GeneratedKpDocumentRecord } from "@app/assistant";
import { createSelectedLeadChatSnapshot } from "./selected-lead-snapshot";

const baseLead: CreatedLeadRecord = {
  id: "lead-record-1",
  workspaceId: "workspace-1",
  leadId: "L-2026-004",
  status: "new",
  rawInput: "Client: Anna Beispiel, anna@example.com",
  clientName: "Anna Beispiel",
  requestType: "new_build",
  projectAddress: "Gartenweg 9",
  bgfM2: 195,
  email: "anna@example.com",
  phone: null,
  missingData: [],
  isStandard: true,
  temperature: "warm"
};

describe("selected lead assistant snapshot", () => {
  it("maps the selected lead and latest generated KP document to shared chat actions", () => {
    const documents: GeneratedKpDocumentRecord[] = [
      {
        id: "generated-document-record-2",
        workspaceId: "workspace-1",
        documentId: "D-newer",
        documentType: "kp",
        sourceRecordIds: ["L-2026-004"],
        rawInput: "newer",
        requestedByUserId: "user-1",
        docxAttachmentId: "docx-new",
        pdfAttachmentId: "pdf-new"
      },
      {
        id: "generated-document-record-1",
        workspaceId: "workspace-1",
        documentId: "D-older",
        documentType: "kp",
        sourceRecordIds: ["L-2026-004"],
        rawInput: "older",
        requestedByUserId: "user-1",
        docxAttachmentId: "docx-old",
        pdfAttachmentId: "pdf-old"
      }
    ];

    expect(createSelectedLeadChatSnapshot("L-2026-004", [baseLead], documents)).toEqual({
      leadId: "L-2026-004",
      missingFields: [],
      kpReady: true,
      pdfUrl: "/documents/attachments/pdf-new",
      docxUrl: "/documents/attachments/docx-new?download=1",
      canSendKp: true,
      kpSent: false,
      clientEmail: "anna@example.com"
    });
  });

  it("marks the selected lead as not KP-ready when required fields are missing", () => {
    expect(
      createSelectedLeadChatSnapshot(
        "L-2026-004",
        [
          {
            ...baseLead,
            missingData: ["projectAddress"]
          }
        ],
        []
      )
    ).toMatchObject({
      leadId: "L-2026-004",
      missingFields: ["projectAddress"],
      kpReady: false,
      canSendKp: false
    });
  });

  it("returns null when the selected lead is absent", () => {
    expect(createSelectedLeadChatSnapshot("L-2026-999", [baseLead], [])).toBeNull();
  });
});
