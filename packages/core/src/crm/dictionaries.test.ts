import { describe, expect, it } from "vitest";
import { crmDictionaries, isClientStatus, isLeadStatus, isProjectStatus } from "./dictionaries";

describe("crmDictionaries", () => {
  it("contains the v1 status dictionaries", () => {
    expect(crmDictionaries.clientStatuses).toContain("active");
    expect(crmDictionaries.leadStatuses).toContain("needs_pricing");
    expect(crmDictionaries.projectStatuses).toContain("archived");
  });

  it("validates known CRM statuses", () => {
    expect(isClientStatus("active")).toBe(true);
    expect(isLeadStatus("new")).toBe(true);
    expect(isProjectStatus("closed")).toBe(true);
    expect(isLeadStatus("mystery")).toBe(false);
  });
});
