export const supportedLocales = ["en", "de", "ru"] as const;

export type SupportedLocale = (typeof supportedLocales)[number];

export type Dictionary = {
  navigation: {
    today: string;
    clients: string;
    leads: string;
    projects: string;
    outreach: string;
    content: string;
    assistant: string;
    settings: string;
  };
  settings: {
    title: string;
    language: string;
    branding: string;
  };
};

const dictionaries: Record<SupportedLocale, Dictionary> = {
  en: {
    navigation: {
      today: "Today",
      clients: "Clients",
      leads: "Leads",
      projects: "Projects",
      outreach: "Cold Targets",
      content: "Content",
      assistant: "Assistant",
      settings: "Settings"
    },
    settings: {
      title: "Workspace settings",
      language: "Language",
      branding: "Branding"
    }
  },
  de: {
    navigation: {
      today: "Heute",
      clients: "Kunden",
      leads: "Leads",
      projects: "Projekte",
      outreach: "Cold Targets",
      content: "Content",
      assistant: "Assistent",
      settings: "Einstellungen"
    },
    settings: {
      title: "Workspace-Einstellungen",
      language: "Sprache",
      branding: "Branding"
    }
  },
  ru: {
    navigation: {
      today: "Сегодня",
      clients: "Клиенты",
      leads: "Лиды",
      projects: "Проекты",
      outreach: "Cold Targets",
      content: "Контент",
      assistant: "Ассистент",
      settings: "Настройки"
    },
    settings: {
      title: "Настройки workspace",
      language: "Язык",
      branding: "Брендинг"
    }
  }
};

export function resolveLocale(locale: string | undefined): SupportedLocale {
  return supportedLocales.includes(locale as SupportedLocale) ? (locale as SupportedLocale) : "en";
}

export function getDictionary(locale: string | undefined): Dictionary {
  return dictionaries[resolveLocale(locale)];
}
