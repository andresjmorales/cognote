"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export type ThemeMode = "light" | "dark";

const STORAGE_KEY = "cognote-teacher-theme";

type ThemeContextValue = {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "dark" || raw === "light") return raw;
  } catch {
    /* ignore */
  }
  return "light";
}

// localStorage is the source of truth; useSyncExternalStore keeps hydration
// safe (server renders light) without a mount effect.
const themeListeners = new Set<() => void>();

function subscribeTheme(listener: () => void) {
  themeListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    themeListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function writeStoredTheme(mode: ThemeMode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
  for (const listener of themeListeners) listener();
}

/**
 * Teacher-Studio theme only. Scoped via data-teacher-theme so student
 * practice, /try, and portal stay light — staff/notation are not dark-themed.
 *
 * Uses data-teacher-theme (not class "dark") so Tailwind's dark variant /
 * prefers-color-scheme machinery does not fight the override. Mirrored onto
 * <html> while mounted so rubber-band overscroll uses the dark background.
 */
export function TeacherThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(
    subscribeTheme,
    readStoredTheme,
    () => "light" as ThemeMode
  );

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-teacher-theme", theme);
    return () => {
      root.removeAttribute("data-teacher-theme");
    };
  }, [theme]);

  const setTheme = useCallback((mode: ThemeMode) => {
    writeStoredTheme(mode);
  }, []);

  const toggleTheme = useCallback(() => {
    writeStoredTheme(readStoredTheme() === "dark" ? "light" : "dark");
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      <div
        className="min-h-screen bg-background text-foreground"
        data-teacher-theme={theme}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useTeacherTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTeacherTheme must be used within TeacherThemeProvider");
  }
  return ctx;
}
