import { revalidatePath } from "next/cache";
import { classifyLeadStandardness, lookupPriceTableRow, parseHonorartabelleTsv, type PriceTableRow } from "@app/core";
import { prisma } from "@app/db";
import { getWorkspaceSession } from "../../../workspace-session";

async function readImportText(formData: FormData, textField: string, fileField: string): Promise<string> {
  const file = formData.get(fileField);
  if (file instanceof File && file.size > 0) {
    return file.text();
  }

  return String(formData.get(textField) ?? "");
}

async function replacePriceTable(formData: FormData) {
  "use server";

  const session = await getWorkspaceSession();
  const input = await readImportText(formData, "priceTableText", "priceTableFile");
  const preview = parseHonorartabelleTsv(input);

  if (preview.warnings.length > 0) {
    throw new Error(preview.warnings.map((warning) => `Row ${warning.rowNumber}: ${warning.message}`).join("\n"));
  }

  await prisma.priceTableRow.deleteMany({ where: { workspaceId: session.workspaceId } });
  await prisma.priceTableRow.createMany({
    data: preview.rows.map((row) => ({
      workspaceId: session.workspaceId,
      bgfFromM2: row.bgfFromM2,
      bgfToM2: row.bgfToM2,
      wohnflaecheApprox: row.wohnflaecheApprox,
      lp3NetEur: row.lp3NetEur,
      lp4NetEur: row.lp4NetEur,
      netEur: row.netEur,
      mwst19Eur: row.mwst19Eur,
      grossEur: row.grossEur
    }))
  });

  revalidatePath("/settings/price-table");
}

function formatEur(value: number): string {
  return `${value.toLocaleString("de-DE")} EUR`;
}

export default async function PriceTableSettingsPage() {
  const session = await getWorkspaceSession();
  const dbRows = await prisma.priceTableRow.findMany({
    where: { workspaceId: session.workspaceId, isActive: true },
    orderBy: [{ bgfFromM2: "asc" }, { bgfToM2: "asc" }]
  });
  const rows: PriceTableRow[] = dbRows.map((row) => ({
    bgfFromM2: row.bgfFromM2,
    bgfToM2: row.bgfToM2,
    wohnflaecheApprox: row.wohnflaecheApprox ?? undefined,
    lp3NetEur: row.lp3NetEur ? Number(row.lp3NetEur) : undefined,
    lp4NetEur: row.lp4NetEur ? Number(row.lp4NetEur) : undefined,
    netEur: Number(row.netEur),
    mwst19Eur: row.mwst19Eur ? Number(row.mwst19Eur) : undefined,
    grossEur: Number(row.grossEur)
  }));
  const sampleBgf = 150;
  const samplePrice = lookupPriceTableRow(rows, sampleBgf);
  const sampleClassification = classifyLeadStandardness({ requestType: "new_build", bgfM2: sampleBgf, priceTableRows: rows });

  return (
    <section className="grid gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Price table</h1>
        <p className="text-sm text-muted-foreground">HONORARTABELLE 2026 · LP 3 + LP 4 · Neubau EFH</p>
      </div>

      <form action={replacePriceTable} className="grid gap-3 rounded-lg border border-border bg-white p-4">
        <textarea
          name="priceTableText"
          className="min-h-32 rounded-md border border-border px-3 py-2 text-sm"
          placeholder="Paste bgf_from TSV here"
        />
        <div className="flex flex-wrap items-center gap-3">
          <input name="priceTableFile" type="file" accept=".csv,.tsv,.txt" className="text-sm" />
          <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            Replace table
          </button>
        </div>
      </form>

      <div className="overflow-auto rounded-lg border border-border bg-white">
        <table className="w-full min-w-[860px] border-collapse text-left text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">BGF</th>
              <th className="px-4 py-3 font-medium">Wohnfläche</th>
              <th className="px-4 py-3 font-medium">LP3 net</th>
              <th className="px-4 py-3 font-medium">LP4 net</th>
              <th className="px-4 py-3 font-medium">Total net</th>
              <th className="px-4 py-3 font-medium">MwSt 19%</th>
              <th className="px-4 py-3 font-medium">Total gross</th>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((row) => (
                <tr key={`${row.bgfFromM2}-${row.bgfToM2}`} className="border-t border-border">
                  <td className="px-4 py-3">{row.bgfFromM2}-{row.bgfToM2} m2</td>
                  <td className="px-4 py-3">{row.wohnflaecheApprox}</td>
                  <td className="px-4 py-3">{row.lp3NetEur ? formatEur(row.lp3NetEur) : ""}</td>
                  <td className="px-4 py-3">{row.lp4NetEur ? formatEur(row.lp4NetEur) : ""}</td>
                  <td className="px-4 py-3">{formatEur(row.netEur)}</td>
                  <td className="px-4 py-3">{row.mwst19Eur ? formatEur(row.mwst19Eur) : ""}</td>
                  <td className="px-4 py-3">{formatEur(row.grossEur)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-3 text-muted-foreground" colSpan={7}>No price rows found yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-border bg-white p-4 text-sm text-muted-foreground">
        Sample {sampleBgf} m2 lead is {sampleClassification.isStandard ? "standard" : "manual"}.
        {samplePrice ? ` Matched net price: ${formatEur(samplePrice.netEur)}.` : null}
      </div>
    </section>
  );
}
