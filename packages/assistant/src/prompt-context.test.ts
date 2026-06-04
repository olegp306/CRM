import { describe, expect, it } from "vitest";
import { appendWorkspacePromptContext } from "./prompt-context";

describe("workspace prompt context", () => {
  it("appends people/project context to a base prompt without mutating it", () => {
    const prompt = appendWorkspacePromptContext({
      basePrompt: "Route CRM requests.",
      peopleContext:
        "Oleg Panyukov is the CRM owner and tester. Ekaterina Reyzbikh is the bureau director, not the client by default.",
      leadContext: "Lead L-2026-004 summary: EFH in Bad Aibling.",
      actionContext: "Current action: update phone from screenshot."
    });

    expect(prompt).toContain("Route CRM requests.");
    expect(prompt).toContain("## Workspace people and project context");
    expect(prompt).toContain("Oleg Panyukov is the CRM owner");
    expect(prompt).toContain("## Current lead context");
    expect(prompt).toContain("EFH in Bad Aibling");
    expect(prompt).toContain("## Current action context");
    expect(prompt).toContain("update phone from screenshot");
  });

  it("returns the base prompt unchanged when no extra context is present", () => {
    expect(appendWorkspacePromptContext({ basePrompt: "Extract entities.", peopleContext: "" })).toBe("Extract entities.");
  });
});
