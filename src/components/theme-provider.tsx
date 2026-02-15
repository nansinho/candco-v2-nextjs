"use client";

import * as React from "react";

type Theme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = React.createContext<ThemeContextValue>({
  theme: "dark",
  toggleTheme: () => {},
});

export function useTheme() {
  return React.useContext(ThemeContext);
}

// Apply custom theme colors from a stored palette
function applyCustomColors(theme: Theme) {
  try {
    const raw = localStorage.getItem("candco-theme-colors");
    if (!raw) return;
    const colors = JSON.parse(raw);
    const palette = theme === "light" ? colors.light : colors.dark;
    if (!palette) return;

    const root = document.documentElement;
    const map: Record<string, string[]> = {
      background: ["--color-background"],
      foreground: ["--color-foreground", "--color-card-foreground", "--color-popover-foreground", "--color-accent-foreground", "--color-secondary-foreground"],
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

    // Update gradient (uses custom gradient colors if available)
    const gradFrom = palette.gradient_from || palette.sidebar || palette.background;
    const gradTo = palette.gradient_to || palette.background;
    if (gradFrom && gradTo) {
      document.body.style.background = `linear-gradient(135deg, ${gradFrom} 0%, ${gradTo} 50%, ${gradTo} 100%)`;
      document.body.style.backgroundAttachment = "fixed";
    }
  } catch {
    // Ignore JSON parse errors
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = React.useState<Theme>("dark");
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    const stored = localStorage.getItem("candco-theme") as Theme | null;
    const current = stored === "light" || stored === "dark" ? stored : "dark";
    setTheme(current);
    document.documentElement.className = current;
    applyCustomColors(current);
    setMounted(true);
  }, []);

  const toggleTheme = React.useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("candco-theme", next);
      document.documentElement.className = next;

      // Clear inline overrides so CSS base values take effect first
      const root = document.documentElement;
      const props = [
        "--color-background", "--color-foreground", "--color-card", "--color-card-foreground",
        "--color-popover", "--color-popover-foreground", "--color-primary", "--color-ring",
        "--color-sidebar", "--color-sidebar-foreground", "--color-header", "--color-header-foreground",
        "--color-border", "--color-input", "--color-muted", "--color-accent", "--color-accent-foreground",
        "--color-secondary", "--color-secondary-foreground",
      ];
      props.forEach((p) => root.style.removeProperty(p));
      document.body.style.removeProperty("background");
      document.body.style.removeProperty("background-attachment");

      // Re-apply custom colors for the new theme
      applyCustomColors(next);

      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <div style={{ visibility: mounted ? "visible" : "hidden" }}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}
