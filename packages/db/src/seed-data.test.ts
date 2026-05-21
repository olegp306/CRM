import { describe, expect, it } from "vitest";
import { createDemoSeedData } from "./seed-data";

describe("createDemoSeedData", () => {
  it("uses stable demo IDs that match the local demo session", () => {
    const seed = createDemoSeedData(new Date("2026-05-21T12:00:00.000Z"));

    expect(seed.workspace.id).toBe("workspace-demo");
    expect(seed.owner.id).toBe("user-demo");
  });

  it("includes the full 2026 honorar table and researched cold targets", () => {
    const seed = createDemoSeedData(new Date("2026-05-21T12:00:00.000Z"));

    expect(seed.priceTableRows).toHaveLength(31);
    expect(seed.priceTableRows[0]).toMatchObject({
      bgfFromM2: 100,
      bgfToM2: 104,
      wohnflaecheApprox: "~75–78",
      lp3NetEur: 4725,
      lp4NetEur: 2025,
      netEur: 6750,
      mwst19Eur: 1285,
      grossEur: 8035
    });
    expect(seed.priceTableRows.at(-1)).toMatchObject({
      bgfFromM2: 250,
      bgfToM2: 254,
      grossEur: 14760
    });
    expect(seed.coldTargets).toHaveLength(11);
    expect(seed.coldTargets[0]).toMatchObject({
      targetId: "T-2026-001",
      companyName: "Projektbau Chiemgau GmbH",
      fitScore: 5,
      priority: "high"
    });
  });
});
