import { describe, expect, it } from "vitest";
import {
  createLeadDraftRawInput,
  getLeadDraftKpStatus,
  mergeLeadDraftFlowState,
  type LeadDraftFlowState
} from "./lead-draft-flow";

const baseDraft: LeadDraftFlowState = {
  clientName: "Katya",
  requestType: "new_build",
  projectAddress: null,
  bgfM2: null,
  email: null,
  phone: null,
  rawInput: "Initial message",
  missingData: ["projectAddress", "bgfM2"],
  sourceExternalIds: ["telegram:12345:5"],
  temperature: "warm",
  isStandard: false
};

describe("lead draft flow", () => {
  it("merges missing-field updates and becomes KP-ready when required fields are complete", () => {
    const result = mergeLeadDraftFlowState(baseDraft, {
      projectAddress: "Chiemseeufer 7",
      bgfM2: 180,
      rawInput: "BGF 180, Chiemseeufer 7",
      missingData: [],
      sourceExternalIds: ["telegram:12345:6"],
      temperature: "unknown"
    });

    expect(result).toMatchObject({
      kpReady: true,
      missingData: [],
      draft: {
        clientName: "Katya",
        requestType: "new_build",
        projectAddress: "Chiemseeufer 7",
        bgfM2: 180,
        missingData: [],
        sourceExternalIds: ["telegram:12345:5", "telegram:12345:6"],
        temperature: "warm"
      }
    });
    expect(result.draft.rawInput).toContain("Initial message");
    expect(result.draft.rawInput).toContain("BGF 180, Chiemseeufer 7");
  });

  it("deduplicates missing data and keeps only still-missing required fields first", () => {
    const result = mergeLeadDraftFlowState(
      { ...baseDraft, missingData: ["projectAddress", "bgfM2", "projectAddress"] },
      {
        projectAddress: "Chiemseeufer 7",
        rawInput: "Address update",
        missingData: ["bgfM2", "budget", "bgfM2"],
        sourceExternalIds: ["telegram:12345:6"]
      }
    );

    expect(result.missingData).toEqual(["bgfM2", "budget"]);
    expect(result.kpReady).toBe(false);
  });

  it("uses template required fields instead of generic required fields", () => {
    const result = mergeLeadDraftFlowState(
      baseDraft,
      {
        projectAddress: "Chiemseeufer 7",
        rawInput: "Address update",
        missingData: ["bgfM2"],
        sourceExternalIds: ["telegram:12345:6"]
      },
      { requiredFields: ["clientName", "projectAddress"] }
    );

    expect(result.kpReady).toBe(true);
    expect(result.missingData).toEqual([]);
  });

  it("appends source external ids without duplicates", () => {
    const result = mergeLeadDraftFlowState(baseDraft, {
      rawInput: "Same source update",
      missingData: [],
      sourceExternalIds: ["telegram:12345:5", "telegram:12345:6"]
    });

    expect(result.draft.sourceExternalIds).toEqual(["telegram:12345:5", "telegram:12345:6"]);
  });

  it("creates raw input blocks with source metadata", () => {
    expect(createLeadDraftRawInput("Initial", "Update", ["telegram:12345:6"])).toBe(
      "Initial\n\n--- draft update ---\n\nUpdate\nShared sources: telegram:12345:6"
    );
  });

  it("reports KP status for custom required field lists", () => {
    expect(getLeadDraftKpStatus({ ...baseDraft, projectAddress: "Munich" }, ["clientName", "projectAddress"])).toEqual({
      ready: true,
      present: ["clientName", "projectAddress"],
      missing: []
    });
  });
});
