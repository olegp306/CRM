export type PriceTableRow = {
  bgfFromM2: number;
  bgfToM2: number;
  netEur: number;
  grossEur: number;
  wohnflaecheApprox?: string;
  lp3NetEur?: number;
  lp4NetEur?: number;
  mwst19Eur?: number;
};

export type PriceTableImportWarning = {
  rowNumber: number;
  field: string;
  message: string;
};

export type PriceTableImportPreview = {
  rows: PriceTableRow[];
  warnings: PriceTableImportWarning[];
};

const HONORAR_HEADER_MAP: Record<string, keyof PriceTableRow> = {
  bgf_from: "bgfFromM2",
  bgffrom: "bgfFromM2",
  bgf_to: "bgfToM2",
  bgfto: "bgfToM2",
  wohnflaeche_approx: "wohnflaecheApprox",
  wohnflaecheapprox: "wohnflaecheApprox",
  lp3_net_eur: "lp3NetEur",
  lp3neteur: "lp3NetEur",
  lp4_net_eur: "lp4NetEur",
  lp4neteur: "lp4NetEur",
  total_net_eur: "netEur",
  totalneteur: "netEur",
  mwst_19_eur: "mwst19Eur",
  mwst19eur: "mwst19Eur",
  total_gross_eur: "grossEur",
  totalgrosseur: "grossEur"
};

export function lookupPriceTableRow<TRow extends PriceTableRow>(rows: readonly TRow[], bgfM2: number): TRow | null {
  return rows.find((row) => bgfM2 >= row.bgfFromM2 && bgfM2 <= row.bgfToM2) ?? null;
}

export function parseHonorartabelleTsv(input: string): PriceTableImportPreview {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { rows: [], warnings: [] };
  }

  const headers = splitDelimitedLine(lines[0]!).map((header) => HONORAR_HEADER_MAP[normalizeHeader(header)] ?? null);
  const rows: PriceTableRow[] = [];
  const warnings: PriceTableImportWarning[] = [];

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const values = splitDelimitedLine(lines[lineIndex]!);
    const row: Partial<PriceTableRow> = {};

    headers.forEach((field, index) => {
      if (!field) {
        return;
      }

      const value = values[index]?.trim();
      if (!value) {
        return;
      }

      if (field === "wohnflaecheApprox") {
        row[field] = value;
        return;
      }

      row[field] = parseEuroNumber(value);
    });

    const rowNumber = lineIndex + 1;
    if (typeof row.bgfFromM2 !== "number") {
      warnings.push({ rowNumber, field: "bgfFromM2", message: "BGF from is required." });
    }
    if (typeof row.bgfToM2 !== "number") {
      warnings.push({ rowNumber, field: "bgfToM2", message: "BGF to is required." });
    }
    if (typeof row.netEur !== "number") {
      warnings.push({ rowNumber, field: "netEur", message: "Total net EUR is required." });
    }
    if (typeof row.grossEur !== "number") {
      warnings.push({ rowNumber, field: "grossEur", message: "Total gross EUR is required." });
    }

    if (
      typeof row.bgfFromM2 === "number" &&
      typeof row.bgfToM2 === "number" &&
      typeof row.netEur === "number" &&
      typeof row.grossEur === "number"
    ) {
      rows.push(row as PriceTableRow);
    }
  }

  return { rows, warnings };
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function splitDelimitedLine(line: string): string[] {
  const delimiter = line.includes("\t") ? "\t" : ",";
  return line.split(delimiter);
}

function parseEuroNumber(value: string): number {
  const normalized = value.replace(/[€\s]/g, "").replace(/\./g, "").replace(",", ".");
  return Number(normalized);
}
