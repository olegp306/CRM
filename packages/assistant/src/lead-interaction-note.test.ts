import { describe, expect, it } from "vitest";
import { createLeadInteractionNoteSummary, isLeadInteractionNoteCommand } from "./lead-interaction-note";

describe("lead interaction note commands", () => {
  it("detects explicit English lead history notes", () => {
    expect(isLeadInteractionNoteCommand("Record that we sent the client a birthday gift.")).toBe(true);
    expect(createLeadInteractionNoteSummary("Record that we sent the client a birthday gift.")).toBe(
      "we sent the client a birthday gift."
    );
  });

  it("detects explicit Russian lead history notes", () => {
    const message =
      "\u0417\u0430\u043f\u0438\u0448\u0438, \u0447\u0442\u043e \u043a\u043b\u0438\u0435\u043d\u0442\u0443 \u043e\u0442\u043f\u0440\u0430\u0432\u0438\u043b\u0438 \u041a\u041f \u0441 \u0431\u043e\u043d\u0443\u0441\u043e\u043c";

    expect(isLeadInteractionNoteCommand(message)).toBe(true);
    expect(createLeadInteractionNoteSummary(message)).toBe(
      "\u043a\u043b\u0438\u0435\u043d\u0442\u0443 \u043e\u0442\u043f\u0440\u0430\u0432\u0438\u043b\u0438 \u041a\u041f \u0441 \u0431\u043e\u043d\u0443\u0441\u043e\u043c"
    );
  });

  it("detects Russian make-a-note commands and keeps the useful note text", () => {
    const message =
      "Сделай пометку, что сегодня встречался с этим человеком за кофе. Оказался очень приятный дядька, который любит джаз.";

    expect(isLeadInteractionNoteCommand(message)).toBe(true);
    expect(createLeadInteractionNoteSummary(message)).toBe(
      "сегодня встречался с этим человеком за кофе. Оказался очень приятный дядька, который любит джаз."
    );
  });

  it("does not treat general questions as lead notes", () => {
    expect(
      isLeadInteractionNoteCommand(
        "\u0427\u0442\u043e \u0434\u0430\u043b\u044c\u0448\u0435 \u043f\u043e \u044d\u0442\u043e\u043c\u0443 \u043b\u0438\u0434\u0443?"
      )
    ).toBe(false);
  });
});
