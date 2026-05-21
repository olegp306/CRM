import { describe, expect, it } from "vitest";
import { createDefaultProjectTemplate } from "./project-template";

describe("createDefaultProjectTemplate", () => {
  it("creates the v1 phase structure", () => {
    const template = createDefaultProjectTemplate();

    expect(template.phases.map((phase) => phase.name)).toEqual([
      "Negotiations",
      "Ecosystem",
      "Client/project discovery",
      "Analysis",
      "File preparation",
      "First sketch",
      "Revisions",
      "LP3",
      "LP4",
      "Submission",
      "Bauamt feedback",
      "Completed/archive"
    ]);
  });

  it("includes decision log setup tasks", () => {
    const template = createDefaultProjectTemplate();
    const ecosystem = template.phases.find((phase) => phase.name === "Ecosystem");

    expect(ecosystem?.tasks.some((task) => task.title === "Create project decision log")).toBe(true);
  });
});
