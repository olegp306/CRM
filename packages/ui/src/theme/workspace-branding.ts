export type WorkspaceBrandingInput = {
  primaryColor?: string | null;
};

export function createWorkspaceThemeStyle({ primaryColor }: WorkspaceBrandingInput): Record<string, string> {
  const rgb = primaryColor ? hexToRgb(primaryColor) : null;

  return rgb ? { "--primary": `${rgb.r} ${rgb.g} ${rgb.b}` } : {};
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
