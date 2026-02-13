"use client";

import * as React from "react";
import type { ThemeMode } from "@/lib/themes";
import {
  getThemePreset,
  getDefaultPreset,
  applyThemeVars,
  clearThemeVars,
} from "@/lib/themes";

interface ThemeContextValue {
  theme: ThemeMode;
  toggleTheme: () => void;
  mode: ThemeMode;
  toggleMode: () => void;
}

const ThemeContext = React.createContext<ThemeContextValue>({
  theme: "dark",
  toggleTheme: () => {},
  mode: "dark",
  toggleMode: () => {},
});

export function useTheme() {
  return React.useContext(ThemeContext);
}

interface ThemeProviderProps {
  children: React.ReactNode;
  orgDarkPresetId?: string;
  orgLightPresetId?: string;
}

export function ThemeProvider({
  children,
  orgDarkPresetId = "cursor",
  orgLightPresetId = "clean",
}: ThemeProviderProps) {
  const [mode, setMode] = React.useState<ThemeMode>("dark");
  const [mounted, setMounted] = React.useState(false);

  // Resolve presets
  const darkPreset = getThemePreset(orgDarkPresetId) ?? getDefaultPreset("dark");
  const lightPreset = getThemePreset(orgLightPresetId) ?? getDefaultPreset("light");

  // Apply theme vars for the active preset
  const applyActivePreset = React.useCallback(
    (currentMode: ThemeMode) => {
      const preset = currentMode === "dark" ? darkPreset : lightPreset;
      const el = document.documentElement;
      // Clear old inline vars then apply new ones
      clearThemeVars(el);
      applyThemeVars(el, preset.vars);
      el.className = currentMode;
    },
    [darkPreset, lightPreset]
  );

  // On mount, read mode from localStorage and apply preset
  React.useEffect(() => {
    const stored = localStorage.getItem("candco-theme") as ThemeMode | null;
    const initial = stored === "light" || stored === "dark" ? stored : "dark";
    setMode(initial);
    applyActivePreset(initial);
    setMounted(true);
  }, [applyActivePreset]);

  const toggleMode = React.useCallback(() => {
    setMode((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("candco-theme", next);
      applyActivePreset(next);
      return next;
    });
  }, [applyActivePreset]);

  const value = React.useMemo<ThemeContextValue>(
    () => ({
      theme: mode,
      toggleTheme: toggleMode,
      mode,
      toggleMode,
    }),
    [mode, toggleMode]
  );

  return (
    <ThemeContext.Provider value={value}>
      <div style={{ visibility: mounted ? "visible" : "hidden" }}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}
