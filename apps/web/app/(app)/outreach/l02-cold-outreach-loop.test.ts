import { describe, expect, it } from "vitest";
import {
  applyColdTargetOutcome,
  buildConvertedColdTargetRecords,
  createOutreachCadence,
  generatePersonaHook,
  markOutreachTouchSent,
  parseColdTargetCsv
} from "@app/core";

describe("L02 Bautraeger cold outreach loop", () => {
  it("imports a cold target, prepares cadence, advances a sent touch, and converts interest into CRM records", () => {
    const importPreview = parseColdTargetCsv(
      [
        "company,website,region,contact_person,email,phone,notes_research",
        "Bauwert GmbH,https://bauwert.example,Berlin,Erika Muster,erika@bauwert.example,+49 30 123,Builds compact urban infill projects near transit hubs."
      ].join("\n")
    );

    expect(importPreview.warnings).toEqual([]);
    expect(importPreview.rows).toEqual([
      {
        companyName: "Bauwert GmbH",
        website: "https://bauwert.example",
        region: "Berlin",
        contactPerson: "Erika Muster",
        email: "erika@bauwert.example",
        phone: "+49 30 123",
        notesResearch: "Builds compact urban infill projects near transit hubs."
      }
    ]);

    const target = {
      id: "cold-target-record-1",
      workspaceId: "workspace-1",
      ...importPreview.rows[0]!
    };
    const cadence = createOutreachCadence(new Date("2026-05-21T00:00:00.000Z"));

    expect(cadence).toHaveLength(8);
    expect(cadence.at(-1)).toMatchObject({
      touchNumber: 8,
      scheduledAt: new Date("2026-07-02T00:00:00.000Z")
    });
    expect(generatePersonaHook(target.notesResearch ?? "")).toBe(
      "Reference their focus on compact urban infill projects near transit hubs."
    );

    const sent = markOutreachTouchSent(target, cadence, 1, new Date("2026-05-21T09:00:00.000Z"));
    expect(sent.sentTouch.status).toBe("sent");
    expect(sent.targetUpdate).toMatchObject({
      currentTouch: 2,
      nextActionDate: new Date("2026-05-24T00:00:00.000Z"),
      nextActionType: "linkedin"
    });

    const interested = applyColdTargetOutcome(target, "interested", new Date("2026-05-22T00:00:00.000Z"));
    expect(interested).toMatchObject({
      outcome: "interested",
      nextActionDate: null,
      nextActionType: null,
      nextReviewDate: null
    });

    const converted = buildConvertedColdTargetRecords({
      target,
      clientId: "C-2026-001",
      leadId: "L-2026-011",
      clientRecordId: "client-record-1",
      leadRecordId: "lead-record-1",
      convertedAt: new Date("2026-05-22T00:00:00.000Z")
    });

    expect(converted.client).toMatchObject({
      workspaceId: "workspace-1",
      clientId: "C-2026-001",
      name: "Bauwert GmbH",
      source: "cold_outreach"
    });
    expect(converted.lead).toMatchObject({
      leadId: "L-2026-011",
      temperature: "warm",
      requestType: "bautraeger_outreach",
      status: "new"
    });
    expect(converted.targetUpdate).toMatchObject({
      outcome: "interested",
      clientRecordId: "client-record-1",
      leadRecordId: "lead-record-1",
      archivedAt: new Date("2026-05-22T00:00:00.000Z")
    });
  });
});
