import { describe, expect, it } from "vitest";
import {
  canMarkLeadKpSent,
  canUndoLeadKpSent,
  clampLeadColumnSizing,
  createLeadActionPlan,
  createLeadCalendarMonthViewModel,
  createLeadCalendarViewModel,
  createLeadHistory,
  createLeadContextItems,
  createLeadKpMailtoHref,
  createKpDownloadBaseName,
  createLeadLoopTimelineViewModel,
  createLeadSummaryInfo,
  createLeadTableRows,
  filterLeadRowsForUrlSearch,
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
      "leadName",
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

  it("keeps extracted CRM entities available for the lead card context panel", () => {
    const [row] = createLeadTableRows([
      {
        id: "lead-record-1",
        leadId: "L-2026-001",
        clientRecordId: null,
        createdDate: "2026-05-21",
        temperature: "warm",
        requestType: "renovation",
        urgency: null,
        budgetEur: null,
        desiredStart: null,
        desiredMoveIn: null,
        bgfM2: null,
        wohnflaecheM2: null,
        projectAddress: "Sochi",
        isStandard: null,
        status: "new",
        rawInput: "Initial",
        missingData: [],
        kpGeneratedDocumentId: null,
        kpSentDate: null,
        followup1Date: null,
        followupStatus: null,
        outcome: null,
        outcomeReason: null,
        projectRecordId: null,
        contextEntities: [
          {
            entityType: "FACT",
            label: "Preference",
            value: "Likes jazz",
            confidence: "high",
            normalizedKey: null
          },
          {
            entityType: "TAG",
            label: "jazz",
            value: "jazz",
            confidence: "high",
            normalizedKey: "hobby_jazz"
          }
        ]
      }
    ]);

    expect(row.contextEntities).toEqual([
      expect.objectContaining({ type: "FACT", label: "Preference", value: "Likes jazz" }),
      expect.objectContaining({ type: "TAG", label: "jazz", normalizedKey: "hobby_jazz" })
    ]);
    expect(createLeadContextItems(row)).toEqual([
      { title: "Preference", description: "Likes jazz", meta: "FACT · high" },
      { title: "jazz", description: "jazz", meta: "TAG · high · hobby_jazz" }
    ]);
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
        title: "Lead summary",
        kind: "summary",
        description: "Ready Neubau EFH lead",
        fullText: "Ready Neubau EFH lead",
        url: null
      },
      {
        title: "Message",
        kind: "message",
        description: "Need EFH offer",
        fullText: "Need EFH offer",
        url: null
      },
      {
        title: "client-brief.mp3",
        kind: "audio",
        description: "Client says the address is Gartenweg 9 and BGF is 195 m2.",
        fullText: "Client says the address is Gartenweg 9 and BGF is 195 m2.",
        url: "/documents/attachments/attachment-audio-1"
      },
      {
        title: "grundriss.pdf",
        kind: "pdf",
        description: "PDF file from Telegram: grundriss.pdf.",
        fullText: "PDF file from Telegram: grundriss.pdf.",
        url: "/documents/attachments/attachment-pdf-1"
      },
    ]);
  });

  it("shows AI material analysis summary and per-file descriptions from raw input", () => {
    expect(
      createLeadSummaryInfo(
        [
          "Need EFH offer",
          "Telegram sources: telegram:-100777:42",
          "Telegram attachment 1: audio (client-brief.mp3, source audio-document, saved attachment-audio-1)",
          "Telegram attachment 2: PDF (grundriss.pdf, saved attachment-pdf-1)",
          "Lead summary: Client wants an LP1-4 commercial proposal for a Neubau EFH in Bad Aibling.",
          "Source material summaries:",
          "- client-brief.mp3: Voice message contains budget, start date, and move-in timing. Transcript: Wir brauchen ein Angebot fuer Gartenweg 9.",
          "- grundriss.pdf: PDF shows the floor plan and confirms BGF 195 m2."
        ].join("\n")
      )
    ).toEqual([
      {
        title: "Lead summary",
        kind: "summary",
        description: "Client wants an LP1-4 commercial proposal for a Neubau EFH in Bad Aibling.",
        fullText: "Client wants an LP1-4 commercial proposal for a Neubau EFH in Bad Aibling.",
        url: null
      },
      {
        title: "Message",
        kind: "message",
        description: "Need EFH offer",
        fullText: "Need EFH offer",
        url: null
      },
      {
        title: "client-brief.mp3",
        kind: "audio",
        description: "Voice message contains budget, start date, and move-in timing.",
        fullText: "Voice message contains budget, start date, and move-in timing.",
        url: "/documents/attachments/attachment-audio-1"
      },
      {
        title: "grundriss.pdf",
        kind: "pdf",
        description: "PDF shows the floor plan and confirms BGF 195 m2.",
        fullText: "PDF shows the floor plan and confirms BGF 195 m2.",
        url: "/documents/attachments/attachment-pdf-1"
      },
    ]);
  });

  it("puts lead summary first and keeps long Telegram text expandable without Telegram links", () => {
    const longMessage =
      "Здравствуйте, меня зовут Ирина Шнайдер, есть проект дома в Bad Aibling, Gartenweg 9, нужно коммерческое предложение на архитектуру для Neubau EFH. Площадь BGF 195 м2, желаемая дата начала сентябрь 2026.";

    expect(
      createLeadSummaryInfo(
        [
          longMessage,
          "Telegram sources: telegram:-100777:42",
          "Lead summary: Client wants an LP1-4 commercial proposal for a Neubau EFH in Bad Aibling."
        ].join("\n")
      )
    ).toEqual([
      {
        title: "Lead summary",
        kind: "summary",
        description: "Client wants an LP1-4 commercial proposal for a Neubau EFH in Bad Aibling.",
        fullText: "Client wants an LP1-4 commercial proposal for a Neubau EFH in Bad Aibling.",
        url: null
      },
      {
        title: "Message",
        kind: "message",
        description:
          "Здравствуйте, меня зовут Ирина Шнайдер, есть проект дома в Bad Aibling, Gartenweg 9, нужно коммерческое предложение на архитектуру для Neubau EFH...",
        fullText: longMessage,
        url: null
      }
    ]);
  });

  it("prefers the material-analysis lead summary over the older parser summary", () => {
    expect(
      createLeadSummaryInfo(
        [
          "Summary: Short parser summary",
          "Lead summary: Detailed client-material analysis summary for the proposal workflow."
        ].join("\n")
      )
    ).toEqual([
      {
        title: "Lead summary",
        kind: "summary",
        description: "Detailed client-material analysis summary for the proposal workflow.",
        fullText: "Detailed client-material analysis summary for the proposal workflow.",
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
    expect(audio?.description.length).toBeLessThanOrEqual(150);
    expect(audio?.description).toContain("This voice message describes a hillside renovation request");
  });

  it("serializes lead records for a client-side table and edit drawer", () => {
    const [row] = createLeadTableRows(
      [
        {
          id: "lead-record-1",
          leadId: "L-2026-001",
          displayName: "Irina Schneider - Neubau EFH in Bad Aibling",
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
      leadName: "Irina Schneider - Neubau EFH in Bad Aibling",
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

  it("falls back to the lead id when a lead name is not available", () => {
    const [row] = createLeadTableRows([
      {
        id: "lead-record-no-name",
        leadId: "L-2026-099",
        clientRecordId: null,
        createdDate: "2026-05-21",
        temperature: "warm",
        requestType: null,
        urgency: null,
        budgetEur: null,
        desiredStart: null,
        desiredMoveIn: null,
        bgfM2: null,
        wohnflaecheM2: null,
        projectAddress: null,
        isStandard: null,
        status: "new",
        rawInput: "",
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

    expect(row.leadName).toBe("L-2026-099");
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

  it("builds a lead action calendar with the next scheduled follow-up", () => {
    const calendar = createLeadCalendarViewModel({
      followup1Date: "2026-05-28",
      followupStatus: "planned",
      outcome: ""
    });

    expect(calendar.nextSummary).toBe("Next: 2026-05-28 - Follow up: Check client reaction and update outcome.");
    expect(calendar.items).toEqual([
      {
        id: "followup-lead-2026-05-28",
        title: "Follow up",
        date: "2026-05-28",
        status: "planned",
        description: "Check client reaction and update outcome.",
        kind: "followup",
        recurrence: null,
        badgeLabel: "Follow-up",
        badgeTone: "amber",
        sourceLabel: "Lead follow-up",
        leadId: undefined,
        leadName: undefined
      }
    ]);
    expect(calendar.initialMonth).toBe("2026-05");
    const month = createLeadCalendarMonthViewModel(calendar.initialMonth, calendar.items);
    expect(month.monthLabel).toBe("May 2026");
    expect(month.weeks).toHaveLength(5);
    expect(month.weeks.flat().find((day) => day.date === "2026-05-28")).toMatchObject({
      day: 28,
      isCurrentMonth: true,
      itemCount: 1,
      items: [calendar.items[0]]
    });
  });

  it("adds CRM calendar actions with recurrence and birthday badges to the lead calendar", () => {
    const calendar = createLeadCalendarViewModel(
      {
        leadId: "L-2026-010",
        leadName: "Artem - house in Munich",
        followup1Date: "",
        followupStatus: "",
        outcome: "",
        calendarActions: [
          {
            id: "calendar-1",
            title: "Birthday",
            description: "Congratulate the client.",
            dueAt: "2026-06-14T09:00:00.000Z",
            recurrence: "yearly",
            status: "planned",
            sourceChannel: "telegram"
          }
        ]
      },
      { today: new Date("2026-06-01T12:00:00.000Z") }
    );

    expect(calendar.nextSummary).toBe("Next: 2026-06-14 - Birthday: Congratulate the client.");
    expect(calendar.items[0]).toMatchObject({
      id: "calendar-1",
      date: "2026-06-14",
      kind: "birthday",
      badgeLabel: "DR yearly",
      badgeTone: "rose",
      leadId: "L-2026-010",
      leadName: "Artem - house in Munich"
    });
  });

  it("filters lead rows from Telegram CRM search URL parameters", () => {
    const rows = createLeadTableRows([
      {
        id: "lead-1",
        leadId: "L-2026-001",
        displayName: "Frau Schneider - Neubau EFH am Chiemsee",
        clientRecordId: null,
        createdDate: "2026-06-02T10:00:00.000Z",
        temperature: "warm",
        requestType: "Neubau EFH",
        urgency: null,
        budgetEur: null,
        desiredStart: null,
        desiredMoveIn: null,
        bgfM2: null,
        wohnflaecheM2: null,
        projectAddress: "Bad Aibling",
        isStandard: true,
        status: "new",
        rawInput: null,
        missingData: [],
        kpGeneratedDocumentId: null,
        kpSentDate: null,
        followup1Date: null,
        followupStatus: null,
        outcome: null,
        outcomeReason: null,
        projectRecordId: null,
        contextEntities: [{ entityType: "TAG", label: "region", value: "chiemsee", confidence: "high", normalizedKey: "chiemsee" }]
      },
      {
        id: "lead-2",
        leadId: "L-2026-002",
        displayName: "Buro GmbH - Office renovation in Berlin",
        clientRecordId: null,
        createdDate: "2026-05-20T10:00:00.000Z",
        temperature: "cold",
        requestType: "Office renovation",
        urgency: null,
        budgetEur: null,
        desiredStart: null,
        desiredMoveIn: null,
        bgfM2: null,
        wohnflaecheM2: null,
        projectAddress: "Berlin",
        isStandard: false,
        status: "needs_data",
        rawInput: null,
        missingData: ["budgetEur"],
        kpGeneratedDocumentId: null,
        kpSentDate: null,
        followup1Date: null,
        followupStatus: null,
        outcome: null,
        outcomeReason: null,
        projectRecordId: null,
        contextEntities: []
      }
    ]);

    const filtered = filterLeadRowsForUrlSearch(rows, {
      leadSearch: "chiemsee",
      temperature: "warm",
      status: null,
      date: "current_month",
      now: new Date("2026-06-10T12:00:00.000Z")
    });

    expect(filtered.map((row) => row.leadId)).toEqual(["L-2026-001"]);
  });

  it("returns an empty lead action calendar when no future action is scheduled", () => {
    const calendar = createLeadCalendarViewModel({
      followup1Date: "",
      followupStatus: "",
      outcome: "contract"
    });

    expect(calendar.nextSummary).toBe("No scheduled future actions yet.");
    expect(calendar.items).toEqual([]);
    expect(calendar.initialMonth).toMatch(/^\d{4}-\d{2}$/);
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
      description: "Request: add note. Action: note saved. Sent the client a birthday gift"
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
