import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(join(__dirname, "page.tsx"), "utf8");

describe("leads page layout", () => {
  it("keeps the leads route focused on the editable lead table", () => {
    expect(pageSource).toContain("<LeadsTable");
    expect(pageSource).not.toContain("L01");
    expect(pageSource).not.toContain("Open intake preview");
    expect(pageSource).not.toContain("Create lead");
    expect(pageSource).not.toContain("Telegram intake");
    expect(pageSource).not.toContain("Create from Telegram");
  });
});
