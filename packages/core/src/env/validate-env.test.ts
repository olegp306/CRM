import { describe, expect, it } from "vitest";
import { validateEnv } from "./validate-env";

describe("validateEnv", () => {
  it("returns typed values for required variables", () => {
    const result = validateEnv({ DATABASE_URL: "postgres://local" }, ["DATABASE_URL"]);

    expect(result.DATABASE_URL).toBe("postgres://local");
  });

  it("reports missing and empty variables together", () => {
    expect(() => validateEnv({ DATABASE_URL: "", SUPABASE_URL: undefined }, ["DATABASE_URL", "SUPABASE_URL"])).toThrow(
      "Missing required environment variables: DATABASE_URL, SUPABASE_URL"
    );
  });
});
