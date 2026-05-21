import { describe, expect, it } from "vitest";
import { lookupPriceTableRow, parseHonorartabelleTsv } from "./price-table";

const rows = [
  { bgfFromM2: 100, bgfToM2: 149, netEur: 12500, grossEur: 14875 },
  { bgfFromM2: 150, bgfToM2: 199, netEur: 16500, grossEur: 19635 },
  { bgfFromM2: 200, bgfToM2: 254, netEur: 21500, grossEur: 25585 }
];

describe("lookupPriceTableRow", () => {
  it("returns the matching inclusive BGF price row", () => {
    expect(lookupPriceTableRow(rows, 150)).toEqual(rows[1]);
    expect(lookupPriceTableRow(rows, 254)).toEqual(rows[2]);
  });

  it("returns null when BGF is outside the standard table", () => {
    expect(lookupPriceTableRow(rows, 99)).toBeNull();
    expect(lookupPriceTableRow(rows, 255)).toBeNull();
  });

  it("parses pasted honorar table rows with LP3, LP4, tax, and gross values", () => {
    const preview = parseHonorartabelleTsv(`bgf_from\tbgf_to\twohnflaeche_approx\tlp3_net_eur\tlp4_net_eur\ttotal_net_eur\tmwst_19_eur\ttotal_gross_eur
100\t104\t~75-78\t4.725 €\t2.025 €\t6.750 €\t1.285 €\t8.035 €
150\t154\t~113-116\t5.985 €\t2.565 €\t8.550 €\t1.625 €\t10.175 €`);

    expect(preview.warnings).toEqual([]);
    expect(preview.rows).toEqual([
      {
        bgfFromM2: 100,
        bgfToM2: 104,
        wohnflaecheApprox: "~75-78",
        lp3NetEur: 4725,
        lp4NetEur: 2025,
        netEur: 6750,
        mwst19Eur: 1285,
        grossEur: 8035
      },
      {
        bgfFromM2: 150,
        bgfToM2: 154,
        wohnflaecheApprox: "~113-116",
        lp3NetEur: 5985,
        lp4NetEur: 2565,
        netEur: 8550,
        mwst19Eur: 1625,
        grossEur: 10175
      }
    ]);
  });
});
