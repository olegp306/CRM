import { describe, expect, it } from "vitest";
import { canMarkLeadKpSent, createLeadActionPlan, createLeadTableRows, leadTableColumns } from "./lead-table-store";

describe("lead table model", () => {
  it("defines all recommended lead fields as sortable table columns", () => {
    expect(leadTableColumns.map((column) => column.key)).toEqual([
      "leadId",
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

  it("serializes lead records for a client-side table and edit drawer", () => {
    const [row] = createLeadTableRows([
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
        kpGeneratedDocumentId: null,
        kpSentDate: null,
        followup1Date: new Date("2026-05-28T00:00:00.000Z"),
        followupStatus: "planned",
        outcome: null,
        outcomeReason: null,
        projectRecordId: null
      }
    ]);

    expect(row).toMatchObject({
      id: "lead-record-1",
      leadId: "L-2026-001",
      createdDate: "2026-05-21",
      desiredStart: "2026-06-01",
      desiredMoveIn: "",
      budgetEur: "12000",
      bgfM2: "150",
      wohnflaecheM2: "112.5",
      isStandard: "yes",
      source: "web",
      missingData: "email",
      followup1Date: "2026-05-28"
    });
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
        rawInput: "Need EFH offer\nTelegram source: telegram:777:42",
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

  it("enables the KP sent quick action only for generated unsent KP leads", () => {
    expect(canMarkLeadKpSent({ kpGeneratedDocumentId: "D-20260521-message-2", kpSentDate: "" })).toBe(true);
    expect(canMarkLeadKpSent({ kpGeneratedDocumentId: "", kpSentDate: "" })).toBe(false);
    expect(canMarkLeadKpSent({ kpGeneratedDocumentId: "D-20260521-message-2", kpSentDate: "2026-05-21" })).toBe(false);
  });
});
