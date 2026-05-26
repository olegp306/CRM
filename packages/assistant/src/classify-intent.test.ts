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
  it("classifies identity and capability questions as support requests, not feature requests", () => {
    expect(classifyIntent("Кто ты и что умеешь делать?")).toBe("support_request");
    expect(classifyIntent("who are you and what can you do?")).toBe("support_request");
  });

  it("does not convert translation or ordinary lead questions into feature requests", () => {
    expect(classifyIntent("Переведи предыдущее сообщение на русский")).toBe("support_request");
    expect(classifyIntent("Почему у лида L-2026-004 нет коммерческого предложения?")).toBe("support_request");
  });

  it("classifies English why and how questions as support requests", () => {
    expect(classifyIntent("Why does lead L-2026-004 have no KP?")).toBe("support_request");
    expect(classifyIntent("How can I update this lead?")).toBe("support_request");
    expect(classifyIntent("What is the status of lead L-2026-004?")).toBe("support_request");
  });

  it("classifies product UI add requests as feature requests before support or CRM actions", () => {
    expect(classifyIntent("How can we add a button to compare KP versions?")).toBe("feature_request");
    expect(classifyIntent("Add a button to compare KP versions")).toBe("feature_request");
  });

  it("keeps operational lead add commands as CRM actions", () => {
    expect(classifyIntent("Add this address to lead L-2026-004")).toBe("crm_action");
    expect(classifyIntent("Help me add this address to lead L-2026-004")).toBe("crm_action");
  });

  it("classifies UX feedback before broad CRM action matching", () => {
    expect(classifyIntent("Adding leads is confusing")).toBe("ux_feedback");
  });

  it("captures explicit product requests as feature requests", () => {
    expect(classifyIntent("Добавьте кнопку для сравнения версий коммерческого предложения")).toBe("feature_request");
    expect(classifyIntent("It would be nice to upload several lead photos in the web assistant")).toBe(
      "feature_request",
    );
  });
});
