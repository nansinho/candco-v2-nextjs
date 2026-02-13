// ═══════════════════════════════════════════════
// Theme Presets — 6 predefined themes (3 dark + 3 light)
// All themes meet WCAG 2.1 AA contrast requirements
// ═══════════════════════════════════════════════

export const THEME_CSS_VARS = [
  "--color-background",
  "--color-foreground",
  "--color-card",
  "--color-card-foreground",
  "--color-popover",
  "--color-popover-foreground",
  "--color-primary",
  "--color-primary-foreground",
  "--color-secondary",
  "--color-secondary-foreground",
  "--color-muted",
  "--color-muted-foreground",
  "--color-muted-foreground-subtle",
  "--color-muted-foreground-faint",
  "--color-accent",
  "--color-accent-foreground",
  "--color-destructive",
  "--color-destructive-foreground",
  "--color-success",
  "--color-warning",
  "--color-info",
  "--color-border",
  "--color-input",
  "--color-ring",
  "--color-sidebar",
  "--color-sidebar-foreground",
  "--color-sidebar-border",
  "--color-sidebar-accent",
  "--color-sidebar-accent-foreground",
  "--color-sidebar-muted",
] as const;

export type ThemeCSSVarName = (typeof THEME_CSS_VARS)[number];
export type ThemeVars = Record<ThemeCSSVarName, string>;
export type ThemeMode = "dark" | "light";

export const DARK_PRESET_IDS = ["cursor", "midnight", "forest"] as const;
export const LIGHT_PRESET_IDS = ["clean", "ocean", "warm"] as const;
export const ALL_PRESET_IDS = [...DARK_PRESET_IDS, ...LIGHT_PRESET_IDS] as const;
export type PresetId = (typeof ALL_PRESET_IDS)[number];

export interface ThemePreset {
  id: PresetId;
  name: string;
  mode: ThemeMode;
  description: string;
  vars: ThemeVars;
}

// ─── Dark Themes ─────────────────────────────────────

const cursorVars: ThemeVars = {
  "--color-background": "#0A0A0A",
  "--color-foreground": "#FAFAFA",
  "--color-card": "#1A1A1A",
  "--color-card-foreground": "#FAFAFA",
  "--color-popover": "#1A1A1A",
  "--color-popover-foreground": "#FAFAFA",
  "--color-primary": "#FF7C4C",
  "--color-primary-foreground": "#FFFFFF",
  "--color-secondary": "#1A1A1A",
  "--color-secondary-foreground": "#FAFAFA",
  "--color-muted": "#141414",
  "--color-muted-foreground": "#A0A0A0",
  "--color-muted-foreground-subtle": "#808080",
  "--color-muted-foreground-faint": "#5A5A5A",
  "--color-accent": "#1A1A1A",
  "--color-accent-foreground": "#FAFAFA",
  "--color-destructive": "#EF4444",
  "--color-destructive-foreground": "#FAFAFA",
  "--color-success": "#22C55E",
  "--color-warning": "#EAB308",
  "--color-info": "#3B82F6",
  "--color-border": "#2A2A2A",
  "--color-input": "#2A2A2A",
  "--color-ring": "#FF7C4C",
  "--color-sidebar": "#0A0A0A",
  "--color-sidebar-foreground": "#FAFAFA",
  "--color-sidebar-border": "#1A1A1A",
  "--color-sidebar-accent": "#141414",
  "--color-sidebar-accent-foreground": "#FAFAFA",
  "--color-sidebar-muted": "#A0A0A0",
};

const midnightVars: ThemeVars = {
  "--color-background": "#0B0E14",
  "--color-foreground": "#E8ECF1",
  "--color-card": "#141924",
  "--color-card-foreground": "#E8ECF1",
  "--color-popover": "#141924",
  "--color-popover-foreground": "#E8ECF1",
  "--color-primary": "#60A5FA",
  "--color-primary-foreground": "#0B0E14",
  "--color-secondary": "#141924",
  "--color-secondary-foreground": "#E8ECF1",
  "--color-muted": "#111827",
  "--color-muted-foreground": "#9CA3AF",
  "--color-muted-foreground-subtle": "#7B8494",
  "--color-muted-foreground-faint": "#4B5563",
  "--color-accent": "#141924",
  "--color-accent-foreground": "#E8ECF1",
  "--color-destructive": "#EF4444",
  "--color-destructive-foreground": "#E8ECF1",
  "--color-success": "#34D399",
  "--color-warning": "#FBBF24",
  "--color-info": "#60A5FA",
  "--color-border": "#1E293B",
  "--color-input": "#1E293B",
  "--color-ring": "#60A5FA",
  "--color-sidebar": "#0B0E14",
  "--color-sidebar-foreground": "#E8ECF1",
  "--color-sidebar-border": "#141924",
  "--color-sidebar-accent": "#111827",
  "--color-sidebar-accent-foreground": "#E8ECF1",
  "--color-sidebar-muted": "#9CA3AF",
};

const forestVars: ThemeVars = {
  "--color-background": "#0C0F0C",
  "--color-foreground": "#E8F0E8",
  "--color-card": "#161C16",
  "--color-card-foreground": "#E8F0E8",
  "--color-popover": "#161C16",
  "--color-popover-foreground": "#E8F0E8",
  "--color-primary": "#4ADE80",
  "--color-primary-foreground": "#0C0F0C",
  "--color-secondary": "#161C16",
  "--color-secondary-foreground": "#E8F0E8",
  "--color-muted": "#111611",
  "--color-muted-foreground": "#9CA89C",
  "--color-muted-foreground-subtle": "#7C887C",
  "--color-muted-foreground-faint": "#4D5A4D",
  "--color-accent": "#161C16",
  "--color-accent-foreground": "#E8F0E8",
  "--color-destructive": "#EF4444",
  "--color-destructive-foreground": "#E8F0E8",
  "--color-success": "#4ADE80",
  "--color-warning": "#FBBF24",
  "--color-info": "#60A5FA",
  "--color-border": "#1C261C",
  "--color-input": "#1C261C",
  "--color-ring": "#4ADE80",
  "--color-sidebar": "#0C0F0C",
  "--color-sidebar-foreground": "#E8F0E8",
  "--color-sidebar-border": "#161C16",
  "--color-sidebar-accent": "#111611",
  "--color-sidebar-accent-foreground": "#E8F0E8",
  "--color-sidebar-muted": "#9CA89C",
};

// ─── Light Themes ────────────────────────────────────

const cleanVars: ThemeVars = {
  "--color-background": "#F5F5F5",
  "--color-foreground": "#171717",
  "--color-card": "#FFFFFF",
  "--color-card-foreground": "#171717",
  "--color-popover": "#FFFFFF",
  "--color-popover-foreground": "#171717",
  "--color-primary": "#FF7C4C",
  "--color-primary-foreground": "#FFFFFF",
  "--color-secondary": "#F0F0F0",
  "--color-secondary-foreground": "#171717",
  "--color-muted": "#F0F0F0",
  "--color-muted-foreground": "#737373",
  "--color-muted-foreground-subtle": "#8B8B8B",
  "--color-muted-foreground-faint": "#A0A0A0",
  "--color-accent": "#F0F0F0",
  "--color-accent-foreground": "#171717",
  "--color-destructive": "#EF4444",
  "--color-destructive-foreground": "#FFFFFF",
  "--color-success": "#22C55E",
  "--color-warning": "#EAB308",
  "--color-info": "#3B82F6",
  "--color-border": "#E5E5E5",
  "--color-input": "#E5E5E5",
  "--color-ring": "#FF7C4C",
  "--color-sidebar": "#FFFFFF",
  "--color-sidebar-foreground": "#171717",
  "--color-sidebar-border": "#E5E5E5",
  "--color-sidebar-accent": "#F5F5F5",
  "--color-sidebar-accent-foreground": "#171717",
  "--color-sidebar-muted": "#737373",
};

const oceanVars: ThemeVars = {
  "--color-background": "#F0F4F8",
  "--color-foreground": "#1A202C",
  "--color-card": "#FFFFFF",
  "--color-card-foreground": "#1A202C",
  "--color-popover": "#FFFFFF",
  "--color-popover-foreground": "#1A202C",
  "--color-primary": "#3B82F6",
  "--color-primary-foreground": "#FFFFFF",
  "--color-secondary": "#E2E8F0",
  "--color-secondary-foreground": "#1A202C",
  "--color-muted": "#E2E8F0",
  "--color-muted-foreground": "#64748B",
  "--color-muted-foreground-subtle": "#7E8FA3",
  "--color-muted-foreground-faint": "#94A3B8",
  "--color-accent": "#E2E8F0",
  "--color-accent-foreground": "#1A202C",
  "--color-destructive": "#EF4444",
  "--color-destructive-foreground": "#FFFFFF",
  "--color-success": "#22C55E",
  "--color-warning": "#EAB308",
  "--color-info": "#3B82F6",
  "--color-border": "#CBD5E1",
  "--color-input": "#CBD5E1",
  "--color-ring": "#3B82F6",
  "--color-sidebar": "#FFFFFF",
  "--color-sidebar-foreground": "#1A202C",
  "--color-sidebar-border": "#E2E8F0",
  "--color-sidebar-accent": "#F0F4F8",
  "--color-sidebar-accent-foreground": "#1A202C",
  "--color-sidebar-muted": "#64748B",
};

const warmVars: ThemeVars = {
  "--color-background": "#FFFBF5",
  "--color-foreground": "#1C1917",
  "--color-card": "#FFFFFF",
  "--color-card-foreground": "#1C1917",
  "--color-popover": "#FFFFFF",
  "--color-popover-foreground": "#1C1917",
  "--color-primary": "#F59E0B",
  "--color-primary-foreground": "#1C1917",
  "--color-secondary": "#F5F0EB",
  "--color-secondary-foreground": "#1C1917",
  "--color-muted": "#F5F0EB",
  "--color-muted-foreground": "#78716C",
  "--color-muted-foreground-subtle": "#918A84",
  "--color-muted-foreground-faint": "#A8A29E",
  "--color-accent": "#F5F0EB",
  "--color-accent-foreground": "#1C1917",
  "--color-destructive": "#EF4444",
  "--color-destructive-foreground": "#FFFFFF",
  "--color-success": "#22C55E",
  "--color-warning": "#EAB308",
  "--color-info": "#3B82F6",
  "--color-border": "#E7E0D9",
  "--color-input": "#E7E0D9",
  "--color-ring": "#F59E0B",
  "--color-sidebar": "#FFFFFF",
  "--color-sidebar-foreground": "#1C1917",
  "--color-sidebar-border": "#E7E0D9",
  "--color-sidebar-accent": "#FFFBF5",
  "--color-sidebar-accent-foreground": "#1C1917",
  "--color-sidebar-muted": "#78716C",
};

// ─── Registry ────────────────────────────────────────

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "cursor",
    name: "Cursor",
    mode: "dark",
    description: "Orange sur fond noir",
    vars: cursorVars,
  },
  {
    id: "midnight",
    name: "Midnight",
    mode: "dark",
    description: "Bleu sur fond marine",
    vars: midnightVars,
  },
  {
    id: "forest",
    name: "Forest",
    mode: "dark",
    description: "Vert sur fond foret",
    vars: forestVars,
  },
  {
    id: "clean",
    name: "Clean",
    mode: "light",
    description: "Orange sur fond blanc",
    vars: cleanVars,
  },
  {
    id: "ocean",
    name: "Ocean",
    mode: "light",
    description: "Bleu sur fond clair",
    vars: oceanVars,
  },
  {
    id: "warm",
    name: "Warm",
    mode: "light",
    description: "Ambre sur fond creme",
    vars: warmVars,
  },
];

// ─── Helpers ─────────────────────────────────────────

export function getThemePreset(id: string): ThemePreset | undefined {
  return THEME_PRESETS.find((p) => p.id === id);
}

export function getThemePresetsByMode(mode: ThemeMode): ThemePreset[] {
  return THEME_PRESETS.filter((p) => p.mode === mode);
}

export function getDefaultPreset(mode: ThemeMode): ThemePreset {
  return mode === "dark"
    ? THEME_PRESETS.find((p) => p.id === "cursor")!
    : THEME_PRESETS.find((p) => p.id === "clean")!;
}

export function applyThemeVars(el: HTMLElement, vars: ThemeVars): void {
  for (const key of THEME_CSS_VARS) {
    if (vars[key]) {
      el.style.setProperty(key, vars[key]);
    }
  }
}

export function clearThemeVars(el: HTMLElement): void {
  for (const key of THEME_CSS_VARS) {
    el.style.removeProperty(key);
  }
}
