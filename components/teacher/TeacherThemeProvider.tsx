"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { THEME_COOKIE, themeColorFor } from "@/lib/pwa";

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
  const secure = location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${THEME_COOKIE}=${mode}; path=/; max-age=31536000; samesite=lax${secure}`;
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

    // Assigning content the value it already holds still records a mutation, so
    // only write when it actually differs — otherwise the observer below spins.
    // Re-query every time: Next replaces the meta element on navigation, so a
    // captured reference goes stale.
    const apply = () => {
      const meta = document.querySelector('meta[name="theme-color"]');
      const wanted = themeColorFor(theme);
      if (meta && meta.getAttribute("content") !== wanted) {
        meta.setAttribute("content", wanted);
      }
    };
    apply();

    // Next re-applies the viewport metadata during client-side navigation, which
    // resets theme-color to the static light default. Re-assert on every head
    // mutation rather than racing that update, so soft navigation lands on the
    // right colour without needing a reload.
    const observer = new MutationObserver(apply);
    observer.observe(document.head, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["content"],
    });

    return () => {
      observer.disconnect();
      root.removeAttribute("data-teacher-theme");
      const meta = document.querySelector('meta[name="theme-color"]');
      meta?.setAttribute("content", themeColorFor("light"));
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
