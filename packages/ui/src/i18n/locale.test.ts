import { describe, expect, it } from "vitest";
import { getDictionary, resolveLocale } from "./locale";

describe("locale helpers", () => {
  it("resolves supported locales", () => {
    expect(resolveLocale("de")).toBe("de");
    expect(resolveLocale("ru")).toBe("ru");
    expect(resolveLocale("en")).toBe("en");
  });

  it("falls back to English for missing or unsupported locales", () => {
    expect(resolveLocale(undefined)).toBe("en");
    expect(resolveLocale("fr")).toBe("en");
  });

  it("returns dictionaries for app navigation", () => {
    expect(getDictionary("en").navigation.clients).toBe("Clients");
    expect(getDictionary("de").navigation.clients).toBe("Kunden");
    expect(getDictionary("ru").navigation.clients).toBe("Клиенты");
  });
});
