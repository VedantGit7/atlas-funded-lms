"use client";

import { useCallback, useLayoutEffect, useState } from "react";

const STORAGE_KEY = "fba-dark";

function readStoredDarkMode(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function writeStoredDarkMode(next: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(next));
  } catch {
    // Private mode / disabled storage — in-memory toggle still works this session.
  }
}

/**
 * Shared brand dark-mode state. Persists to localStorage under a single key so
 * the preference stays consistent across the landing page and auth screens.
 * Returns `darkMode` as `false` until mounted to keep SSR markup stable.
 */
export function useFbaTheme() {
  const [darkMode, setDarkMode] = useState(false);
  const [mounted, setMounted] = useState(false);

  // useLayoutEffect so the stored preference applies before paint and the
  // toggle is interactive immediately after hydration (not on the next frame).
  useLayoutEffect(() => {
    setMounted(true);
    setDarkMode(readStoredDarkMode());
  }, []);

  const toggleDark = useCallback(() => {
    setDarkMode((prev) => {
      const next = !prev;
      writeStoredDarkMode(next);
      return next;
    });
  }, []);

  return { darkMode: mounted && darkMode, toggleDark, mounted };
}
