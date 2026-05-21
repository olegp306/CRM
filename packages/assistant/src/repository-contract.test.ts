import { describe, expect, it } from "vitest";
import type { AssistantRepositoryContract } from "./repository-contract";

describe("assistant repository contract", () => {
  it("documents required repository methods", () => {
    const methodNames: Array<keyof AssistantRepositoryContract> = [
      "save",
      "listThreads",
      "listMessages",
      "listFeedback",
      "updateFeedbackStatus",
      "listActions",
      "updateActionExecutionResult",
      "listAuditEvents",
      "clear"
    ];

    expect(methodNames).toHaveLength(9);
  });
});
