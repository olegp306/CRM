import { describe, expect, it } from "vitest";
import { currentAppChangelog } from "./app-changelog";
import { currentAppMetadata } from "./app-metadata";

describe("app changelog", () => {
  it("tracks the current app version with concise release notes", () => {
    expect(currentAppChangelog.version).toBe(currentAppMetadata.version);
    expect(currentAppChangelog.items.length).toBeGreaterThanOrEqual(3);
    expect(currentAppChangelog.items.join(" ")).toContain("Telegram");
  });
});
