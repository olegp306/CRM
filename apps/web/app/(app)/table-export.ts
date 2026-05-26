export type CsvExportColumn = {
  key: string;
  label: string;
};

export type CsvExportRow = Record<string, unknown>;

export function createCsvExport(columns: CsvExportColumn[], rows: CsvExportRow[]): string {
  const lines = [
    columns.map((column) => escapeCsvCell(column.label)).join(","),
    ...rows.map((row) => columns.map((column) => escapeCsvCell(row[column.key])).join(","))
  ];

  return `\uFEFF${lines.join("\r\n")}`;
}

export function createCsvDownloadFilename(kind: string, date = new Date()): string {
  return `crm-${sanitizeCsvFilenamePart(kind)}-${date.toISOString().slice(0, 10)}.csv`;
}

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function sanitizeCsvFilenamePart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}
