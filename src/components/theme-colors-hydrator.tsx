"use client";

import { useEffect } from "react";

/**
 * Hydrates theme colors from server (DB) into localStorage and applies CSS variables.
 * This bridges the gap between database-stored colors and the client-side ThemeProvider
 * which only reads from localStorage.
 */
export function ThemeColorsHydrator({
  themeColorsJson,
}: {
  themeColorsJson: string | null;
}) {
  useEffect(() => {
    if (!themeColorsJson) return;

    try {
      // Only update localStorage if the server data differs from the cached version
      const cached = localStorage.getItem("candco-theme-colors");
      if (cached === themeColorsJson) return;

      // Write server colors to localStorage so ThemeProvider picks them up
      localStorage.setItem("candco-theme-colors", themeColorsJson);

      // Apply CSS variables immediately
      const colors = JSON.parse(themeColorsJson);
      const theme = document.documentElement.className as "dark" | "light";
      const palette = theme === "light" ? colors.light : colors.dark;
      if (!palette) return;

      const root = document.documentElement;
      const map: Record<string, string[]> = {
        background: ["--color-background"],
        foreground: [
          "--color-foreground",
          "--color-card-foreground",
          "--color-popover-foreground",
          "--color-accent-foreground",
          "--color-secondary-foreground",
        ],
        card: ["--color-card", "--color-popover"],
        primary: ["--color-primary", "--color-ring"],
        sidebar: ["--color-sidebar"],
        header: ["--color-header"],
        border: ["--color-border", "--color-input"],
        muted: ["--color-muted", "--color-secondary"],
        accent: ["--color-accent"],
      };

      for (const [key, vars] of Object.entries(map)) {
        if (palette[key]) {
          vars.forEach((v) => root.style.setProperty(v, palette[key]));
        }
      }

      // sidebar/header foreground follows main foreground
      if (palette.foreground) {
        root.style.setProperty("--color-sidebar-foreground", palette.foreground);
        root.style.setProperty("--color-header-foreground", palette.foreground);
      }

      // Update gradient for light mode
      if (theme === "light" && palette.sidebar && palette.background) {
        document.body.style.background = `linear-gradient(135deg, ${palette.sidebar} 0%, ${palette.background} 50%, ${palette.background} 100%)`;
        document.body.style.backgroundAttachment = "fixed";
      }
    } catch {
      // Ignore JSON parse errors
    }
  }, [themeColorsJson]);

  return null;
}
