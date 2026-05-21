import { describe, expect, it } from "vitest";
import { createKpSentLeadUpdate } from "./kp-sent-action";

describe("createKpSentLeadUpdate", () => {
  it("marks KP as sent and schedules the first follow-up seven days later", () => {
    expect(createKpSentLeadUpdate(new Date("2026-05-21T10:30:00.000Z"))).toEqual({
      status: "kp_sent",
      kpSentDate: new Date("2026-05-21T10:30:00.000Z"),
      followup1Date: new Date("2026-05-28T10:30:00.000Z"),
      followupStatus: "planned"
    });
  });
});
