import { describe, expect, it } from "vitest";
import { createExecutionChannelEvents } from "./execution-channel-events";

describe("execution channel events", () => {
  it("creates a duplicate-prevention event for partial lead matches", () => {
    expect(
      createExecutionChannelEvents({
        channel: "web",
        threadId: "thread-1",
        execution: {
          status: "executed",
          actionType: "needs_clarification",
          leadId: "L-2026-004",
          recordId: "lead-record-4",
          matchedFields: ["projectAddress"]
        }
      })
    ).toEqual([
      {
        type: "lead_match_detected",
        channel: "web",
        threadId: "thread-1",
        leadId: "L-2026-004",
        matchType: "needs_clarification",
        matchedFields: ["projectAddress"]
      }
    ]);
  });

  it("creates a duplicate-prevention event for exact duplicate leads", () => {
    expect(
      createExecutionChannelEvents({
        channel: "web",
        threadId: "thread-1",
        execution: {
          status: "executed",
          actionType: "duplicate_lead",
          leadId: "L-2026-004",
          recordId: "lead-record-4",
          reason: "same_text"
        }
      })
    ).toEqual([
      {
        type: "lead_match_detected",
        channel: "web",
        threadId: "thread-1",
        leadId: "L-2026-004",
        matchType: "duplicate",
        matchedFields: []
      }
    ]);
  });
});
