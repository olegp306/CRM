import { describe, expect, it } from "vitest";
import { decideIncomingLeadMatch } from "./lead-match-decision";

describe("lead match decision", () => {
  it("detects an exact duplicate from an already saved Telegram source id", () => {
    expect(
      decideIncomingLeadMatch({
        incoming: {
          rawInput: "Need EFH offer",
          sourceExternalIds: ["telegram:12345:5"]
        },
        candidates: [
          {
            leadId: "L-2026-002",
            rawInput: "Need EFH offer\nTelegram sources: telegram:12345:5"
          }
        ]
      })
    ).toEqual({
      kind: "exact_duplicate",
      leadId: "L-2026-002",
      reason: "source_external_id"
    });
  });

  it("detects a likely update when client identity and project address match", () => {
    expect(
      decideIncomingLeadMatch({
        incoming: {
          rawInput: "Add BGF 190 and budget 32000 EUR",
          clientName: "Irina Schneider",
          projectAddress: "Bad Aibling, Gartenweg 9"
        },
        candidates: [
          {
            leadId: "L-2026-035",
            rawInput: "Irina Schneider asks for Neubau EFH",
            clientName: "Irina Schneider",
            projectAddress: "Bad Aibling, Gartenweg 9"
          }
        ]
      })
    ).toEqual({
      kind: "likely_update",
      leadId: "L-2026-035",
      reason: "matched lead identity and project data",
      matchedFields: ["clientName", "projectAddress"]
    });
  });

  it("asks for clarification when only one weak lead signal matches", () => {
    expect(
      decideIncomingLeadMatch({
        incoming: {
          rawInput: "Budget is 30000 EUR",
          projectAddress: "Gartenweg 9"
        },
        candidates: [
          {
            leadId: "L-2026-035",
            rawInput: "Irina Schneider, Gartenweg 9"
          }
        ]
      })
    ).toEqual({
      kind: "needs_clarification",
      leadId: "L-2026-035",
      reason: "partial match",
      matchedFields: ["rawInput"]
    });
  });
});
