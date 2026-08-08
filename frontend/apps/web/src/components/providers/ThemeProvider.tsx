"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type ResolvedTheme = "light" | "dark";

type ThemeContextValue = {
  resolvedTheme: ResolvedTheme;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

type ThemeProviderProps = Readonly<{
  children: ReactNode;
}>;

function readResolvedTheme(): ResolvedTheme {
  if (typeof document === "undefined") {
    return "light";
  }

  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");

  useEffect(() => {
    const syncTheme = () => {
      setResolvedTheme(readResolvedTheme());
    };

    syncTheme();

    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", syncTheme);

    return () => {
      observer.disconnect();
      media.removeEventListener("change", syncTheme);
    };
  }, []);

  const value = useMemo(() => ({ resolvedTheme }), [resolvedTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useResolvedTheme(): ResolvedTheme {
  const context = useContext(ThemeContext);
  return context?.resolvedTheme ?? "light";
}
