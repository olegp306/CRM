import { describe, expect, it } from "vitest";
import { getAppNavigationItems, getNavigationDisplayHref, getNavigationPendingLabel } from "./app-navigation";

describe("getAppNavigationItems", () => {
  it("covers the first-card workspace shell routes in order", () => {
    expect(getAppNavigationItems("en").map((item) => ({ href: item.href, label: item.label }))).toEqual([
      { href: "/today", label: "Today" },
      { href: "/clients", label: "Clients" },
      { href: "/leads", label: "Leads" },
      { href: "/projects", label: "Projects" },
      { href: "/outreach", label: "Cold Targets" },
      { href: "/content", label: "Content" },
      { href: "/assistant/preview", label: "Assistant" },
      { href: "/onboarding", label: "Onboarding" },
      { href: "/settings", label: "Settings" }
    ]);
  });

  it("formats a visible loading label for route transitions", () => {
    expect(getNavigationPendingLabel("Clients")).toBe("Loading Clients...");
  });

  it("uses the pending route as the visual active route during navigation", () => {
    expect(getNavigationDisplayHref("/today", "/clients")).toBe("/clients");
  });
});
