export type WorkspaceBrandingInput = {
  primaryColor?: string | null;
  themePreference?: "light" | "dark" | "warm" | null;
};

const themeTokens: Record<NonNullable<WorkspaceBrandingInput["themePreference"]>, Record<string, string>> = {
  light: {},
  dark: {
    "--background": "18 18 18",
    "--surface": "31 31 31",
    "--foreground": "245 245 244",
    "--muted": "43 43 43",
    "--muted-foreground": "168 162 158",
    "--border": "68 64 60",
    "--primary-foreground": "255 255 255"
  },
  warm: {
    "--background": "252 247 240",
    "--surface": "255 251 245",
    "--foreground": "41 33 27",
    "--muted": "244 234 222",
    "--muted-foreground": "105 83 67",
    "--border": "225 211 196",
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
