import { describe, expect, it } from "vitest";
import {
  applyColdTargetOutcome,
  buildConvertedColdTargetRecords,
  createOutreachCadence,
  generatePersonaHook,
  markOutreachTouchSent,
  parseColdTargetCsv
} from "./cold-outreach";

describe("L02 cold outreach domain", () => {
  it("imports cold targets from CSV with duplicate and validation warnings", () => {
    const csv = [
      "company,website,region,contact_person,email,notes_research",
      "Bauwert GmbH,https://bauwert.example,Berlin,Erika Muster,erika@bauwert.example,Builds compact urban infill projects",
      "Bauwert GmbH,https://bauwert.example,Berlin,Erika Muster,erika@bauwert.example,Duplicate row",
      ",https://nameless.example,Hamburg,,info@nameless.example,Missing company"
    ].join("\n");

    const preview = parseColdTargetCsv(csv);

    expect(preview.rows).toHaveLength(3);
    expect(preview.rows[0]).toMatchObject({
      companyName: "Bauwert GmbH",
      website: "https://bauwert.example",
      region: "Berlin",
      contactPerson: "Erika Muster",
      email: "erika@bauwert.example"
    });
    expect(preview.warnings).toEqual([
      { rowNumber: 3, field: "duplicate", message: "Duplicate cold target by company/website/email." },
      { rowNumber: 4, field: "companyName", message: "Company name is required." }
    ]);
  });

  it("parses pasted cold target tables with target metadata", () => {
    const preview = parseColdTargetCsv(
      [
        "target_id\tclient_id\tcompany_name\twebsite\tregion\taddress\tcontact_person\tcontact_role\temail\tphone\tlinkedin_url\tfit_score\tpriority\tnotes_research",
        "T-2026-001\t\tProjektbau Chiemgau GmbH\thttps://www.projektbau-chiemgau.de\tChiemgau\tVierzehnheilgenstraße 108, 83071 Stephanskirchen\tPhilipp Bürstlinger\tGeschäftsführer, Dipl.-Ing. Bauingenieur\tinfo@projektbau-chiemgau.de\t+49 8036 30 195 20\t\t5\thigh\tИдеальный профиль: им нужен архитектор-партнёр."
      ].join("\n")
    );

    expect(preview.warnings).toEqual([]);
    expect(preview.rows[0]).toEqual({
      targetId: "T-2026-001",
      companyName: "Projektbau Chiemgau GmbH",
      website: "https://www.projektbau-chiemgau.de",
      region: "Chiemgau",
      address: "Vierzehnheilgenstraße 108, 83071 Stephanskirchen",
      contactPerson: "Philipp Bürstlinger",
      contactRole: "Geschäftsführer, Dipl.-Ing. Bauingenieur",
      email: "info@projektbau-chiemgau.de",
      phone: "+49 8036 30 195 20",
      fitScore: 5,
      priority: "high",
      notesResearch: "Идеальный профиль: им нужен архитектор-партнёр."
    });
  });

  it("creates 8 outreach touches over 6 weeks", () => {
    const cadence = createOutreachCadence(new Date("2026-05-21T00:00:00.000Z"));

    expect(cadence).toEqual([
      { touchNumber: 1, channel: "email", scheduledAt: new Date("2026-05-21T00:00:00.000Z"), status: "pending" },
      { touchNumber: 2, channel: "linkedin", scheduledAt: new Date("2026-05-24T00:00:00.000Z"), status: "pending" },
      { touchNumber: 3, channel: "call", scheduledAt: new Date("2026-05-28T00:00:00.000Z"), status: "pending" },
      { touchNumber: 4, channel: "email", scheduledAt: new Date("2026-06-04T00:00:00.000Z"), status: "pending" },
      { touchNumber: 5, channel: "linkedin", scheduledAt: new Date("2026-06-11T00:00:00.000Z"), status: "pending" },
      { touchNumber: 6, channel: "call", scheduledAt: new Date("2026-06-18T00:00:00.000Z"), status: "pending" },
      { touchNumber: 7, channel: "email", scheduledAt: new Date("2026-06-25T00:00:00.000Z"), status: "pending" },
      { touchNumber: 8, channel: "linkedin", scheduledAt: new Date("2026-07-02T00:00:00.000Z"), status: "pending" }
    ]);
  });

  it("generates persona hooks from research notes", () => {
    expect(generatePersonaHook("Builds compact urban infill projects near transit hubs.")).toBe(
      "Reference their focus on compact urban infill projects near transit hubs."
    );
  });

  it("marks a touch as sent and advances the active cadence", () => {
    const cadence = createOutreachCadence(new Date("2026-05-21T00:00:00.000Z"));

    const result = markOutreachTouchSent(
      {
        id: "target-record-1",
        workspaceId: "workspace-1",
        companyName: "Bauwert GmbH"
      },
      cadence,
      1,
      new Date("2026-05-21T09:00:00.000Z")
    );

    expect(result.sentTouch).toMatchObject({
      touchNumber: 1,
      channel: "email",
      status: "sent",
      sentAt: new Date("2026-05-21T09:00:00.000Z")
    });
    expect(result.targetUpdate).toMatchObject({
      currentTouch: 2,
      lastTouchDate: new Date("2026-05-21T09:00:00.000Z"),
      nextActionDate: new Date("2026-05-24T00:00:00.000Z"),
      nextActionType: "linkedin"
    });
  });

  it("stops cadence with review dates and converts interested targets into client and lead records", () => {
    const now = new Date("2026-05-21T00:00:00.000Z");
    const target = {
      id: "target-record-1",
      workspaceId: "workspace-1",
      companyName: "Bauwert GmbH",
      website: "https://bauwert.example",
      contactPerson: "Erika Muster",
      email: "erika@bauwert.example",
      phone: "+49 30 123",
      notesResearch: "Builds compact urban infill projects.",
      currentTouch: 3
    };

    expect(applyColdTargetOutcome(target, "not_interested", now)).toMatchObject({
      outcome: "not_interested",
      nextActionDate: null,
      nextActionType: null,
      nextReviewDate: new Date("2026-08-19T00:00:00.000Z")
    });

    const converted = buildConvertedColdTargetRecords({
      target,
      clientId: "C-2026-001",
      leadId: "L-2026-010",
      clientRecordId: "client-record-1",
      leadRecordId: "lead-record-1",
      convertedAt: now
    });

    expect(converted.client).toMatchObject({
      clientId: "C-2026-001",
      name: "Bauwert GmbH",
      clientType: "company",
      email: "erika@bauwert.example",
      phone: "+49 30 123",
      source: "cold_outreach"
    });
    expect(converted.lead).toMatchObject({
      leadId: "L-2026-010",
      clientRecordId: "client-record-1",
      temperature: "warm",
      requestType: "bautraeger_outreach",
      status: "new",
      rawInput: "Converted from cold outreach target Bauwert GmbH."
    });
    expect(converted.targetUpdate).toMatchObject({
      clientRecordId: "client-record-1",
      leadRecordId: "lead-record-1",
      outcome: "interested",
      nextActionDate: null,
      nextActionType: null,
      convertedAt: now,
      archivedAt: now
    });
  });
});
