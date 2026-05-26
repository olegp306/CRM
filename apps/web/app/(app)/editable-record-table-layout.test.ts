import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const tableSource = readFileSync(join(__dirname, "editable-record-table.tsx"), "utf8");
const clientsPageSource = readFileSync(join(__dirname, "clients", "page.tsx"), "utf8");
const projectsPageSource = readFileSync(join(__dirname, "projects", "page.tsx"), "utf8");
const outreachPageSource = readFileSync(join(__dirname, "outreach", "page.tsx"), "utf8");

describe("editable record table CSV export controls", () => {
  it("renders an optional CSV export link in shared editable tables", () => {
    expect(tableSource).toContain("exportHref");
    expect(tableSource).toContain("Export to Excel (CSV)");
  });

  it("wires CSV export links for the shared CRM tables", () => {
    expect(clientsPageSource).toContain('exportHref="/exports/clients"');
    expect(projectsPageSource).toContain('exportHref="/exports/projects"');
    expect(outreachPageSource).toContain('exportHref="/exports/cold-targets"');
  });
});
