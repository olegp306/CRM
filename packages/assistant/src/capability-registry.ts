import type { AssistantChannelMessage, AssistantChannelResponse, AssistantChannelResponseButton } from "./channel-message";

export type AssistantCapabilityId = "theme_switching";

export type AssistantCapability = {
  id: AssistantCapabilityId;
  title: string;
  available: boolean;
};

const themeCapability: AssistantCapability = {
  id: "theme_switching",
  title: "Theme switching",
  available: true
};

export function findAssistantCapability(content: string): AssistantCapability | null {
  return isThemeCapabilityRequest(content) ? themeCapability : null;
}

export function createCapabilityResponse(message: AssistantChannelMessage): AssistantChannelResponse | null {
  const capability = findAssistantCapability(message.content);

  if (!capability) {
    return null;
  }

  if (capability.id === "theme_switching") {
    return createThemeSwitchingResponse(message);
  }

  return null;
}

function createThemeSwitchingResponse(message: AssistantChannelMessage): AssistantChannelResponse {
  if (message.channel === "web") {
    return {
      intent: "capability_request",
      shouldPersistFeedback: false,
      feedbackType: undefined,
      buttons: [
        { label: "Nocturne", action: "set_theme", value: "nocturne" },
        { label: "Graphite", action: "set_theme", value: "graphite" },
        { label: "Settings", url: "/settings/branding" }
      ],
      normalizedActions: [],
      text: [
        "Yes, CRM has interface themes.",
        "For evening work you can switch to Nocturne or Graphite. I can apply one here, or you can open Settings > Branding."
      ].join("\n\n")
    };
  }

  return {
    intent: "feature_request",
    shouldPersistFeedback: true,
    feedbackType: "feature_request",
    buttons: [{ label: "Settings", url: "/settings/branding" }],
    normalizedActions: [],
    text: [
      "Yes, CRM has interface themes: Nocturne and Graphite for evening work.",
      "Telegram cannot safely switch your web session theme yet because this chat is not linked to a browser session. I saved that missing Telegram action as a feature request and you can switch it now in Settings > Branding."
    ].join("\n\n")
  };
}

function isThemeCapabilityRequest(content: string): boolean {
  const text = content.toLowerCase();
  if (/(?:С†РІРµС‚РѕРІ|СЃС…РµРј|С‚РµРјРЅ|С‚РµРјР°).*(?:РµСЃС‚|РјРѕР¶РЅ|С…РѕС‡)|(?:РµСЃС‚|РјРѕР¶РЅ|С…РѕС‡).*(?:С†РІРµС‚РѕРІ|СЃС…РµРј|С‚РµРјРЅ|С‚РµРјР°)/i.test(text)) {
    return true;
  }
  const hasThemeSignal =
    /\b(theme|dark mode|night mode|evening theme|color scheme|appearance|graphite|nocturne)\b/i.test(text) ||
    /(тема|темн\w*|ночн\w*\s+режим|вечерн\w*\s+тем|цветов\w*\s+схем|оформлен|внешн\w*\s+вид)/i.test(text);

  if (!hasThemeSignal) {
    return false;
  }

  return (
    /\b(do you have|is there|can i|can we|switch|enable|turn on|set|change|use)\b/i.test(text) ||
    /(есть|можно|включи|переключи|поставь|смени|изменить|хочу)/i.test(text)
  );
}
