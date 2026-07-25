"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: Theme;
  setTheme: (theme: Theme) => void;
  themes: Theme[];
  systemTheme: Theme | undefined;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  resolvedTheme: "light",
  setTheme: () => {},
  themes: ["light", "dark"],
  systemTheme: undefined,
});

function getSystemTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProviderRoot({
  children,
  defaultTheme = "light",
  enableSystem = false,
  storageKey = "theme",
  themes = ["light", "dark"],
}: {
  children: ReactNode;
  defaultTheme?: Theme;
  enableSystem?: boolean;
  storageKey?: string;
  themes?: Theme[];
}) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return defaultTheme;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored && themes.includes(stored as Theme)) return stored as Theme;
    } catch {
      // ignore
    }
    return defaultTheme;
  });

  const [systemTheme, setSystemTheme] = useState<Theme | undefined>(() => {
    if (typeof window === "undefined") return undefined;
    return getSystemTheme();
  });

  const resolvedTheme: Theme = theme === "system" ? (systemTheme ?? "light") : theme;

  const applyTheme = useCallback(
    (t: Theme) => {
      const root = document.documentElement;
      root.classList.remove("light", "dark");
      const effective = t === "system" ? (systemTheme ?? "light") : t;
      root.style.colorScheme = effective;
      root.classList.add(effective);
    },
    [systemTheme]
  );

  useEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme, applyTheme]);

  useEffect(() => {
    if (!enableSystem || typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setSystemTheme(media.matches ? "dark" : "light");
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, [enableSystem]);

  const handleSetTheme = useCallback(
    (t: Theme) => {
      setTheme(t);
      try {
        localStorage.setItem(storageKey, t);
      } catch {
        // ignore
      }
    },
    [storageKey]
  );

  const value: ThemeContextValue = {
    theme,
    resolvedTheme,
    setTheme: handleSetTheme,
    themes,
    systemTheme,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
