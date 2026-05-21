import { describe, expect, it } from "vitest";
import { advanceActionConfirmation } from "./confirmation-state";

describe("advanceActionConfirmation", () => {
  it("moves draft actions to awaiting confirmation when previewed", () => {
    expect(advanceActionConfirmation("draft", "preview")).toBe("awaiting_confirmation");
  });

  it("confirms awaiting actions and rejects invalid transitions", () => {
    expect(advanceActionConfirmation("awaiting_confirmation", "confirm")).toBe("confirmed");
    expect(() => advanceActionConfirmation("draft", "confirm")).toThrow("Cannot confirm action from draft");
  });

  it("supports cancel from awaiting confirmation", () => {
    expect(advanceActionConfirmation("awaiting_confirmation", "cancel")).toBe("cancelled");
  });
});
