import { describe, expect, it } from "vitest";
import { createCsvDownloadFilename, createCsvExport } from "./table-export";

describe("table CSV export", () => {
  it("exports visible labels with UTF-8 BOM and Excel-safe escaping", () => {
    const csv = createCsvExport(
      [
        { key: "name", label: "Name" },
        { key: "notes", label: "Notes" }
      ],
      [
        { name: "Ирина Шнайдер", notes: "Line 1\nLine \"2\", with comma" },
        { name: "Empty notes", notes: null }
      ]
    );

    expect(csv).toBe('\uFEFFName,Notes\r\nИрина Шнайдер,"Line 1\nLine ""2"", with comma"\r\nEmpty notes,');
  });

  it("creates stable CSV filenames per table kind", () => {
    expect(createCsvDownloadFilename("leads", new Date("2026-05-26T10:00:00.000Z"))).toBe("crm-leads-2026-05-26.csv");
  });
});
