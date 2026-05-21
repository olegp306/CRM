import { describe, expect, it } from "vitest";
import { classifyIntent } from "./classify-intent";

describe("classifyIntent", () => {
  it("detects feature requests", () => {
    expect(classifyIntent("Please add a better mobile view for project tasks")).toBe("feature_request");
  });

  it("detects bug reports", () => {
    expect(classifyIntent("The KP generation button does not work")).toBe("bug_report");
  });

  it("detects CRM actions", () => {
    expect(classifyIntent("Create a lead from this text")).toBe("crm_action");
  });

  it("detects Russian CRM actions", () => {
    expect(classifyIntent("Отметь КП отправленным")).toBe("crm_action");
  });
});
