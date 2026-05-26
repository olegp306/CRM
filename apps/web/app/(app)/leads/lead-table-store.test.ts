import { describe, expect, it } from "vitest";
import {
  canMarkLeadKpSent,
  canUndoLeadKpSent,
  clampLeadColumnSizing,
  createLeadActionPlan,
  createLeadHistory,
  createLeadKpMailtoHref,
  createKpDownloadBaseName,
  createLeadLoopTimelineViewModel,
  createLeadSummaryInfo,
  createLeadTableRows,
  getLeadSourceMaterials,
  inlineEditableLeadFields,
  isInlineEditableLeadField,
  leadMobileCardFields,
  leadMobileViewModes,
  leadTableColumns,
  leadTableViewModeStorageKey,
  leadTableViewModes,
  normalizeLeadTableViewMode,
  resolveDeepLinkedLeadRowId,
  resolveInitialSelectedLeadId
} from "./lead-table-store";

describe("lead table model", () => {
  it("defines all recommended lead fields as sortable table columns", () => {
    expect(leadTableColumns.map((column) => column.key)).toEqual([
      "leadId",
      "loopStage",
      "clientRecordId",
      "createdDate",
      "temperature",
      "requestType",
      "urgency",
      "budgetEur",
      "desiredStart",
      "desiredMoveIn",
      "bgfM2",
      "wohnflaecheM2",
      "projectAddress",
      "isStandard",
      "status",
      "source",
      "rawInput",
      "missingData",
      "kpGeneratedDocumentId",
      "kpSentDate",
      "followup1Date",
      "followupStatus",
      "outcome",
      "outcomeReason",
      "projectRecordId"
    ]);
    expect(leadTableColumns.every((column) => column.enableSorting)).toBe(true);
  });

  it("defines split, full, and inline lead table view modes", () => {
    expect(leadTableViewModes.map((mode) => mode.id)).toEqual(["split", "full", "inline"]);
    expect(leadTableViewModeStorageKey).toBe("crm.table.leads.view-mode.v1");
    expect(normalizeLeadTableViewMode("full")).toBe("full");
    expect(normalizeLeadTableViewMode("inline")).toBe("inline");
    expect(normalizeLeadTableViewMode("entire")).toBe("split");
  });

  it("opens every lead view on the list without auto-selecting a lead", () => {
    expect(resolveInitialSelectedLeadId("split", ["lead-1", "lead-2"])).toBeNull();
    expect(resolveInitialSelectedLeadId("full", ["lead-1", "lead-2"])).toBeNull();
    expect(resolveInitialSelectedLeadId("inline", ["lead-1", "lead-2"])).toBeNull();
    expect(resolveInitialSelectedLeadId("split", [])).toBeNull();
  });

  it("resolves a Telegram CRM deep link to the matching lead row", () => {
    const rows = [
      { id: "lead-record-1", leadId: "L-2026-001" },
      { id: "lead-record-2", leadId: "L-2026-002" }
    ];

    expect(resolveDeepLinkedLeadRowId(rows, "L-2026-002")).toBe("lead-record-2");
    expect(resolveDeepLinkedLeadRowId(rows, "lead-record-1")).toBe("lead-record-1");
    expect(resolveDeepLinkedLeadRowId(rows, "L-2026-999")).toBeNull();
    expect(resolveDeepLinkedLeadRowId(rows, null)).toBeNull();
  });

  it("defines mobile card and table modes with date visible on cards", () => {
    expect(leadMobileViewModes.map((mode) => mode.id)).toEqual(["cards", "table"]);
    expect(leadMobileCardFields).toEqual(["createdDate", "status", "requestType", "projectAddress", "source"]);
  });

  it("limits inline editing to safe scalar workflow fields", () => {
    expect(inlineEditableLeadFields).toEqual([
      "temperature",
      "requestType",
      "urgency",
      "budgetEur",
      "status",
      "projectAddress",
      "followupStatus",
      "outcome"
    ]);
    expect(isInlineEditableLeadField("status")).toBe(true);
    expect(isInlineEditableLeadField("rawInput")).toBe(false);
    expect(isInlineEditableLeadField("missingData")).toBe(false);
  });

  it("bounds large source-text columns so persisted widths cannot stretch the lead table", () => {
    expect(leadTableColumns.find((column) => column.key === "rawInput")).toMatchObject({
      defaultSize: 220,
      maxSize: 480
    });
    expect(
      clampLeadColumnSizing({
        rawInput: 1400,
        missingData: 900,
        leadId: 180
      })
    ).toEqual({
      rawInput: 480,
      missingData: 360,
      leadId: 180
    });
  });

  it("extracts source materials from saved Telegram raw input", () => {
    expect(
      getLeadSourceMaterials("Need EFH offer\nTelegram sources: telegram:-100777:42, telegram:777:43\nTelegram attachment 1: PDF (lead.pdf)")
    ).toEqual({
      references: [
        { label: "telegram:-100777:42", url: "https://t.me/c/777/42" },
        { label: "telegram:777:43", url: "https://t.me/c/777/43" },
        { label: "Telegram attachment 1: PDF (lead.pdf)", url: null }
      ],
      sourceText: "Need EFH offer\nTelegram sources: telegram:-100777:42, telegram:777:43\nTelegram attachment 1: PDF (lead.pdf)"
    });
  });

  it("summarizes saved source materials with attachment links and audio transcript snippets", () => {
    expect(
      createLeadSummaryInfo(
        [
          "Need EFH offer",
          "Telegram sources: telegram:-100777:42",
          "Telegram attachment 1: audio (client-brief.mp3, source audio-document, saved attachment-audio-1)",
          "Audio transcript 1 (client-brief.mp3):",
          "Client says the address is Gartenweg 9 and BGF is 195 m2.",
          "Telegram attachment 2: PDF (grundriss.pdf, saved attachment-pdf-1)",
          "Summary: Ready Neubau EFH lead"
        ].join("\n")
      )
    ).toEqual([
      {
        title: "Telegram message",
        kind: "message",
        description: "telegram:-100777:42",
        url: "https://t.me/c/777/42"
      },
      {
        title: "client-brief.mp3",
        kind: "audio",
        description: "Client says the address is Gartenweg 9 and BGF is 195 m2.",
        url: "/documents/attachments/attachment-audio-1?download=1"
      },
      {
        title: "grundriss.pdf",
        kind: "pdf",
        description: "PDF file from Telegram: grundriss.pdf.",
        url: "/documents/attachments/attachment-pdf-1?download=1"
      },
      {
        title: "Lead summary",
        kind: "summary",
        description: "Ready Neubau EFH lead",
        url: null
      }
    ]);
  });

  it("keeps file descriptions concise in lead summary info", () => {
    const [photo, audio] = createLeadSummaryInfo(
      [
        "Telegram attachment 1: photo (image/jpeg, saved attachment-photo-1)",
        "Telegram attachment 2: audio (very-long-audio-file-name.mp3, saved attachment-audio-2)",
        "Audio transcript 2 (very-long-audio-file-name.mp3):",
        "This voice message describes a hillside renovation request with address, scope, timeline, preferred start date, budget expectations, and follow-up context for the KP workflow."
      ].join("\n")
    );

    expect(photo).toMatchObject({
      title: "image/jpeg",
      kind: "photo",
      description: "Photo file from Telegram: image/jpeg."
    });
    expect(audio?.description.length).toBeLessThanOrEqual(120);
    expect(audio?.description).toContain("This voice message describes a hillside renovation request");
  });

  it("serializes lead records for a client-side table and edit drawer", () => {
    const [row] = createLeadTableRows(
      [
        {
          id: "lead-record-1",
          leadId: "L-2026-001",
          clientRecordId: "client-record-1",
          createdDate: new Date("2026-05-21T10:00:00.000Z"),
          temperature: "warm",
          requestType: "new_build",
          urgency: "soon",
          budgetEur: 12000,
          desiredStart: new Date("2026-06-01T00:00:00.000Z"),
          desiredMoveIn: null,
          bgfM2: 150,
          wohnflaecheM2: 112.5,
          projectAddress: "Chiemseeufer 7",
          isStandard: true,
          status: "new",
          rawInput: "Client asks for EFH LP1-4 and KP.",
          missingData: ["email"],
          kpGeneratedDocumentId: "D-telegram-12345-13",
          kpSentDate: null,
          followup1Date: new Date("2026-05-28T00:00:00.000Z"),
          followupStatus: "planned",
          outcome: null,
          outcomeReason: null,
          projectRecordId: null
        }
      ],
      [{ documentId: "D-telegram-12345-13", docxAttachmentId: "attachment-docx-1", pdfAttachmentId: "attachment-pdf-1" }]
    );

    expect(row).toMatchObject({
      id: "lead-record-1",
      leadId: "L-2026-001",
      loopStage: "5. Standard vs custom branch",
      createdDate: "2026-05-21",
      desiredStart: "2026-06-01",
      desiredMoveIn: "",
      budgetEur: "12000",
      bgfM2: "150",
      wohnflaecheM2: "112.5",
      isStandard: "yes",
      source: "web",
      missingData: "email",
      followup1Date: "2026-05-28",
      kpGeneratedDocumentId: "D-telegram-12345-13",
      kpDocxAttachmentId: "attachment-docx-1",
      kpPdfAttachmentId: "attachment-pdf-1"
    });
  });

  it("attaches persisted channel events to serialized lead rows", () => {
    const [row] = createLeadTableRows(
      [
        {
          id: "lead-record-channel",
          leadId: "L-2026-020",
          clientRecordId: null,
          createdDate: "2026-05-21",
          temperature: "warm",
          requestType: "new_build",
          urgency: null,
          budgetEur: null,
          desiredStart: null,
          desiredMoveIn: null,
          bgfM2: 180,
          wohnflaecheM2: null,
          projectAddress: "Chiemseeufer 7",
          isStandard: true,
          status: "new",
          rawInput: "Telegram sources: telegram:12345:42",
          missingData: [],
          kpGeneratedDocumentId: null,
          kpSentDate: null,
          followup1Date: null,
          followupStatus: null,
          outcome: null,
          outcomeReason: null,
          projectRecordId: null
        }
      ],
      [],
      {
        "L-2026-020": [
          {
            createdAt: "2026-05-21T10:00:00.000Z",
            metadata: { type: "lead_created", channel: "telegram", threadId: "telegram:12345", leadId: "L-2026-020" }
          }
        ]
      }
    );

    expect(row.channelEvents).toEqual([
      {
        createdAt: "2026-05-21T10:00:00.000Z",
        metadata: { type: "lead_created", channel: "telegram", threadId: "telegram:12345", leadId: "L-2026-020" }
      }
    ]);
  });

  it("marks Telegram leads from their raw source marker", () => {
    const [row] = createLeadTableRows([
      {
        id: "lead-record-telegram",
        leadId: "L-2026-009",
        clientRecordId: null,
        createdDate: "2026-05-21",
        temperature: "hot",
        requestType: "new_build",
        urgency: "high",
        budgetEur: null,
        desiredStart: null,
        desiredMoveIn: null,
        bgfM2: 180,
        wohnflaecheM2: null,
        projectAddress: "Chiemseeufer 7",
        isStandard: true,
        status: "new",
        rawInput: "Need EFH offer\nTelegram sources: telegram:777:42",
        missingData: [],
        kpGeneratedDocumentId: null,
        kpSentDate: null,
        followup1Date: null,
        followupStatus: null,
        outcome: null,
        outcomeReason: null,
        projectRecordId: null
      }
    ]);

    expect(row.source).toBe("telegram");
  });

  it("creates a practical action plan from lead state", () => {
    expect(
      createLeadActionPlan({
        missingData: "email, phone",
        isStandard: "yes",
        kpGeneratedDocumentId: "",
        kpSentDate: "",
        followup1Date: "2026-05-28",
        outcome: "",
        projectRecordId: ""
      })
    ).toEqual([
      {
        title: "Complete missing data",
        dueDate: "Now",
        status: "due",
        description: "Resolve: email, phone"
      },
      {
        title: "Generate KP",
        dueDate: "After data check",
        status: "planned",
        description: "Standard lead can use price table and KP template."
      },
      {
        title: "Follow up",
        dueDate: "2026-05-28",
        status: "planned",
        description: "Check client reaction and update outcome."
      },
      {
        title: "Capture outcome",
        dueDate: "After response",
        status: "waiting",
        description: "Mark won, lost, thinking, or archive with reason."
      }
    ]);
  });

  it("keeps a sent KP in follow-up state instead of asking to send it again", () => {
    expect(
      createLeadActionPlan({
        missingData: "",
        isStandard: "yes",
        kpGeneratedDocumentId: "D-20260521-message-2",
        kpSentDate: "2026-05-21",
        followup1Date: "2026-05-28",
        outcome: "",
        projectRecordId: ""
      }).map((item) => item.title)
    ).toEqual(["Follow up", "Capture outcome"]);
  });

  it("builds a collapsed-card history from the lead workflow state", () => {
    const history = createLeadHistory({
      leadId: "L-2026-004",
      createdDate: "2026-05-21",
      source: "telegram",
      temperature: "hot",
      requestType: "information_request",
      projectAddress: "Chiemseeufer 7",
      bgfM2: "180",
      budgetEur: "25000",
      isStandard: "yes",
      missingData: "",
      kpGeneratedDocumentId: "D-local-l-2026-004",
      kpSentDate: "2026-05-23",
      followup1Date: "2026-05-30",
      followupStatus: "planned",
      outcome: "",
      projectRecordId: ""
    });

    expect(history.map((item) => item.title)).toEqual([
      "Lead created",
      "Fields imported",
      "Automatic checks",
      "KP generated",
      "KP sent",
      "Follow-up scheduled"
    ]);
    expect(history[0]).toMatchObject({
      at: "2026-05-21",
      actor: "Telegram",
      stageLabel: "Step 4"
    });
    expect(history[1].description).toContain("requestType, projectAddress, bgfM2, budgetEur, isStandard");
    expect(history[2].description).toContain("Standard pricing branch is available");
    expect(history[4]).toMatchObject({
      actor: "Operator",
      at: "2026-05-23"
    });
  });

  it("prepends channel audit events to lead history in chronological order", () => {
    const history = createLeadHistory({
      leadId: "L-2026-004",
      createdDate: "2026-05-21",
      source: "telegram",
      temperature: "hot",
      requestType: "information_request",
      projectAddress: "Chiemseeufer 7",
      bgfM2: "180",
      budgetEur: "25000",
      isStandard: "yes",
      missingData: "",
      kpGeneratedDocumentId: "D-local-l-2026-004",
      kpSentDate: "",
      followup1Date: "",
      followupStatus: "",
      outcome: "",
      projectRecordId: "",
      channelEvents: [
        {
          createdAt: "2026-05-21T11:00:00.000Z",
          metadata: {
            type: "kp_generated",
            channel: "telegram",
            threadId: "telegram:12345",
            leadId: "L-2026-004",
            documentId: "D-local-l-2026-004"
          }
        },
        {
          createdAt: "2026-05-21T10:00:00.000Z",
          metadata: {
            type: "lead_created",
            channel: "telegram",
            threadId: "telegram:12345",
            leadId: "L-2026-004",
            fieldsCreated: ["clientName", "projectAddress", "bgfM2"],
            missingData: []
          }
        }
      ]
    });

    expect(history.slice(0, 2)).toEqual([
      expect.objectContaining({
        title: "Lead created",
        at: "2026-05-21 10:00",
        actor: "Telegram",
        description: "Telegram created lead L-2026-004 with clientName, projectAddress, bgfM2."
      }),
      expect.objectContaining({
        title: "KP generated",
        at: "2026-05-21 11:00",
        actor: "Telegram",
        description: "Telegram generated commercial proposal D-local-l-2026-004."
      })
    ]);
  });

  it("shows Telegram interaction notes in lead history", () => {
    const history = createLeadHistory({
      leadId: "L-2026-044",
      createdDate: "2026-05-26",
      source: "telegram",
      temperature: "warm",
      requestType: "new_build",
      projectAddress: "Obernsee",
      bgfM2: "",
      budgetEur: "",
      isStandard: "no",
      missingData: "",
      kpGeneratedDocumentId: "",
      kpSentDate: "",
      followup1Date: "",
      followupStatus: "",
      outcome: "",
      projectRecordId: "",
      channelEvents: [
        {
          createdAt: "2026-05-26T13:00:00.000Z",
          metadata: {
            type: "lead_interaction_note",
            channel: "telegram",
            threadId: "telegram:12345",
            leadId: "L-2026-044",
            messageId: "92",
            summary: "Sent the client a birthday gift"
          }
        }
      ]
    });

    expect(history[0]).toMatchObject({
      title: "Telegram note",
      actor: "Telegram",
      stageLabel: "Interaction",
      description: "Sent the client a birthday gift"
    });
  });

  it("shows assistant duplicate-prevention matches in lead history", () => {
    const history = createLeadHistory({
      leadId: "L-2026-044",
      createdDate: "2026-05-26",
      source: "web",
      temperature: "warm",
      requestType: "new_build",
      projectAddress: "Obernsee",
      bgfM2: "",
      budgetEur: "",
      isStandard: "no",
      missingData: "",
      kpGeneratedDocumentId: "",
      kpSentDate: "",
      followup1Date: "",
      followupStatus: "",
      outcome: "",
      projectRecordId: "",
      channelEvents: [
        {
          createdAt: "2026-05-26T13:00:00.000Z",
          metadata: {
            type: "lead_match_detected",
            channel: "web",
            threadId: "thread-1",
            leadId: "L-2026-044",
            matchType: "needs_clarification",
            matchedFields: ["projectAddress"]
          }
        }
      ]
    });

    expect(history[0]).toMatchObject({
      title: "Needs clarification",
      actor: "Operator",
      stageLabel: "Duplicate check",
      description: "Operator found a possible existing lead match by projectAddress."
    });
  });

  it("shows an undo history entry when a generated KP is back before sent state", () => {
    const history = createLeadHistory({
      leadId: "L-2026-004",
      createdDate: "2026-05-21",
      source: "telegram",
      temperature: "hot",
      requestType: "information_request",
      projectAddress: "",
      bgfM2: "",
      budgetEur: "",
      isStandard: "yes",
      missingData: "",
      kpGeneratedDocumentId: "D-local-l-2026-004",
      kpSentDate: "",
      followup1Date: "",
      followupStatus: "",
      outcome: "",
      projectRecordId: ""
    });

    expect(history.map((item) => item.title)).toContain("Undo to KP review");
    expect(history.find((item) => item.title === "Undo to KP review")).toMatchObject({
      actor: "Operator",
      stageLabel: "Step 5"
    });
  });

  it("builds a KP mailto link from lead files and raw email", () => {
    const href = createLeadKpMailtoHref(
      {
        leadId: "L-2026-004",
        rawInput: "Katya email katya@example.com asks for a KP.",
        kpPdfAttachmentId: "attachment-pdf-1",
        kpDocxAttachmentId: "attachment-docx-1"
      },
      "https://crm.example.com"
    );

    expect(href).toContain("mailto:katya%40example.com");
    expect(href).toContain("subject=KP%20L-2026-004");
    expect(href).toContain("https%3A%2F%2Fcrm.example.com%2Fdocuments%2Fattachments%2Fattachment-pdf-1");
    expect(href).toContain("https%3A%2F%2Fcrm.example.com%2Fdocuments%2Fattachments%2Fattachment-docx-1");
  });

  it("builds a readable KP download filename from lead initials, id, and created date", () => {
    expect(
      createKpDownloadBaseName({
        leadId: "L-2026-004",
        createdDate: "2026-05-21",
        rawInput: "Client: Anna Beispiel\nNeed a standard KP."
      })
    ).toBe("AB-KP-L-2026-004-2026-05-21");
  });

  it("does not build a KP mailto link without KP files", () => {
    expect(createLeadKpMailtoHref({ leadId: "L-2026-004", rawInput: "katya@example.com" }, "https://crm.example.com")).toBeNull();
  });

  it("enables the KP sent quick action only for generated unsent KP leads", () => {
    expect(canMarkLeadKpSent({ kpGeneratedDocumentId: "D-20260521-message-2", kpSentDate: "" })).toBe(true);
    expect(canMarkLeadKpSent({ kpGeneratedDocumentId: "", kpSentDate: "" })).toBe(false);
    expect(canMarkLeadKpSent({ kpGeneratedDocumentId: "D-20260521-message-2", kpSentDate: "2026-05-21" })).toBe(false);
  });

  it("enables KP sent undo only for generated sent KP leads", () => {
    expect(canUndoLeadKpSent({ kpGeneratedDocumentId: "D-20260521-message-2", kpSentDate: "2026-05-21" })).toBe(true);
    expect(canUndoLeadKpSent({ kpGeneratedDocumentId: "D-20260521-message-2", kpSentDate: "" })).toBe(false);
    expect(canUndoLeadKpSent({ kpGeneratedDocumentId: "", kpSentDate: "2026-05-21" })).toBe(false);
  });

  it("builds the nine-step Loop 1 timeline with mode and current-step markers", () => {
    const timeline = createLeadLoopTimelineViewModel({
      missingData: "",
      isStandard: "yes",
      kpGeneratedDocumentId: "D-telegram-12345-13",
      kpSentDate: "",
      followup1Date: "",
      outcome: "",
      projectRecordId: ""
    });

    expect(timeline.steps).toHaveLength(9);
    expect(timeline.steps.map((step) => step.mode)).toEqual([
      "manual",
      "automatic",
      "automatic",
      "automatic",
      "branch",
      "manual",
      "manual",
      "automatic",
      "automatic"
    ]);
    expect(timeline.currentStepId).toBe(5);
    expect(timeline.steps.map((step) => step.progressState)).toEqual([
      "done",
      "done",
      "done",
      "done",
      "current",
      "upcoming",
      "upcoming",
      "upcoming",
      "upcoming"
    ]);
    expect(timeline.steps.find((step) => step.id === 5)).toMatchObject({
      title: "Standard vs custom branch",
      description: "CRM classifies whether standard pricing can be used or manual pricing is needed.",
      isCurrent: true
    });
  });

  it("moves the Loop 1 current marker to follow-up after KP is sent", () => {
    const timeline = createLeadLoopTimelineViewModel({
      missingData: "",
      isStandard: "yes",
      kpGeneratedDocumentId: "D-telegram-12345-13",
      kpSentDate: "2026-05-23",
      followup1Date: "2026-05-30",
      outcome: "",
      projectRecordId: ""
    });

    expect(timeline.currentStepId).toBe(8);
    expect(timeline.steps.find((step) => step.id === 8)?.isCurrent).toBe(true);
  });
});
