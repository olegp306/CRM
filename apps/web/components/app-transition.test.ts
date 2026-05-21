import { describe, expect, it } from "vitest";
import { getRoutePendingPresentation, getRoutePendingPreview } from "./app-transition";

describe("getRoutePendingPresentation", () => {
  it("blurs pending route content without rendering a separate loading overlay", () => {
    expect(getRoutePendingPresentation(true)).toEqual({
      contentClassName: "pointer-events-none opacity-35 blur-[1px] grayscale",
      renderOverlay: false
    });
  });

  it("keeps settled route content clear", () => {
    expect(getRoutePendingPresentation(false)).toEqual({
      contentClassName: "",
      renderOverlay: false
    });
  });

  it("returns the target route preview while a navigation is pending", () => {
    expect(getRoutePendingPreview("/clients")).toEqual({
      href: "/clients",
      title: "Clients",
      description: "People and companies connected to leads and projects."
    });
  });

  it("does not invent a preview for unknown or settled routes", () => {
    expect(getRoutePendingPreview(null)).toBeNull();
    expect(getRoutePendingPreview("/unknown")).toBeNull();
  });
});
