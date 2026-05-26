export type WorkspaceBrandingInput = {
  primaryColor?: string | null;
  themePreference?: "light" | "dark" | "nocturne" | "graphite" | "warm" | null;
};

const themeTokens: Record<NonNullable<WorkspaceBrandingInput["themePreference"]>, Record<string, string>> = {
  light: {
    "--background": "248 250 250",
    "--surface": "255 255 255",
    "--foreground": "24 29 29",
    "--muted": "236 241 240",
    "--muted-foreground": "79 91 89",
    "--border": "215 225 223",
    "--primary-foreground": "255 255 255"
  },
  dark: {
    "--background": "18 20 19",
    "--surface": "29 32 31",
    "--foreground": "236 241 238",
    "--muted": "39 44 42",
    "--muted-foreground": "167 177 173",
    "--border": "64 72 69",
    "--primary-foreground": "255 255 255"
  },
  nocturne: {
    "--background": "18 20 19",
    "--surface": "29 32 31",
    "--foreground": "236 241 238",
    "--muted": "39 44 42",
    "--muted-foreground": "167 177 173",
    "--border": "64 72 69",
    "--primary-foreground": "255 255 255"
  },
  graphite: {
    "--background": "12 14 17",
    "--surface": "24 27 31",
    "--foreground": "238 242 246",
    "--muted": "35 39 45",
    "--muted-foreground": "164 174 186",
    "--border": "58 65 74",
    "--primary-foreground": "255 255 255"
  },
  warm: {
    "--background": "246 248 243",
    "--surface": "255 255 252",
    "--foreground": "31 37 32",
    "--muted": "232 238 226",
    "--muted-foreground": "91 104 88",
    "--border": "210 222 205",
    "--primary-foreground": "255 255 255"
  }
};

export function createWorkspaceThemeStyle({ primaryColor, themePreference }: WorkspaceBrandingInput): Record<string, string> {
  const rgb = primaryColor ? hexToRgb(primaryColor) : null;
  const style = { ...(themePreference ? themeTokens[themePreference] ?? {} : {}) };

  return rgb ? { ...style, "--primary": `${rgb.r} ${rgb.g} ${rgb.b}` } : style;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = /^#(?<r>[0-9a-f]{2})(?<g>[0-9a-f]{2})(?<b>[0-9a-f]{2})$/i.exec(hex);

  if (!match?.groups) {
    return null;
  }

  return {
    r: Number.parseInt(match.groups.r, 16),
    g: Number.parseInt(match.groups.g, 16),
    b: Number.parseInt(match.groups.b, 16)
  };
}
