import { describe, expect, it } from "vitest";
import { createDeterministicCrmEntityExtraction, normalizeCrmEntityExtraction } from "./crm-entity-extractor";

describe("crm entity extractor", () => {
  it("extracts explicit Russian follow-up, person, and tags", () => {
    const extraction = createDeterministicCrmEntityExtraction({
      text: "Напомни завтра маякнуть Артему и запросить документы по участку в Вестфалии. Он инвестор, интересуется реконструкцией.",
      receivedAt: "2026-06-02T10:00:00.000Z",
      timezone: "Europe/Paris"
    });

    expect(extraction.followups[0]).toMatchObject({
      type: "FOLLOW_UP",
      title: "маякнуть Артему и запросить документы по участку в Вестфалии"
    });
    expect(extraction.followups[0]?.dueAt).toBe("2026-06-03T10:00:00.000Z");
    expect(extraction.people).toContainEqual(expect.objectContaining({ label: "Артему" }));
    expect(extraction.tags.map((tag) => tag.value)).toEqual(
      expect.arrayContaining(["business_investor", "project_reconstruction", "needs_documents", "project_land_plot"])
    );
  });

  it("normalizes invalid AI JSON into empty arrays and medium confidence", () => {
    const extraction = normalizeCrmEntityExtraction({
      facts: [{ value: "Client likes jazz", confidence: "high" }],
      confidence: { overall: "high" }
    });

    expect(extraction.facts).toHaveLength(1);
    expect(extraction.facts[0]).toMatchObject({
      type: "FACT",
      label: "Client likes jazz",
      value: "Client likes jazz",
      confidence: "high"
    });
    expect(extraction.events).toEqual([]);
    expect(extraction.followups).toEqual([]);
    expect(extraction.people).toEqual([]);
    expect(extraction.organizations).toEqual([]);
    expect(extraction.tags).toEqual([]);
    expect(extraction.confidence.overall).toBe("high");
  });
});
