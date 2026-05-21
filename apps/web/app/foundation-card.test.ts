import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "..", "..", "..");

describe("Card 1 app foundation", () => {
  it("has workspace files and base app routes", () => {
    const requiredPaths = [
      "package.json",
      "pnpm-workspace.yaml",
      "tsconfig.base.json",
      "apps/web/app/layout.tsx",
      "apps/web/app/page.tsx",
      "apps/web/app/(app)/layout.tsx",
      "apps/web/app/(app)/today/page.tsx",
      "apps/web/app/(app)/clients/page.tsx",
      "apps/web/app/(app)/leads/page.tsx",
      "apps/web/app/(app)/projects/page.tsx",
      "apps/web/app/(app)/settings/page.tsx",
      "apps/web/components/app-sidebar.tsx",
      "apps/web/components/assistant-button.tsx"
    ];

    expect(requiredPaths.filter((path) => !existsSync(join(root, path)))).toEqual([]);
  });
});
