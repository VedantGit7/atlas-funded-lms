"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { ATLAS_UI_MODE_COOKIE } from "../lib/auth-cookies";

type ThemeModeToggleProps = {
  /** Override styling so the control matches the surrounding shell tokens. */
  className?: string;
  iconClassName?: string;
};

function documentIsDark(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
}

/**
 * Reusable light/dark switch. Flips the `.dark` class for an instant change and
 * persists the choice via the same `atlas_ui_mode` cookie that ThemeInitScript
 * reads on first paint, so the preference survives reloads across the app.
 */
export function ThemeModeToggle({ className, iconClassName }: ThemeModeToggleProps) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(documentIsDark());
    const observer = new MutationObserver(() => {
      setIsDark(documentIsDark());
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => {
      observer.disconnect();
    };
  }, []);

  function toggle() {
    const next = !documentIsDark();
    document.documentElement.classList.toggle("dark", next);
    document.cookie = `${ATLAS_UI_MODE_COOKIE}=${next ? "dark" : "light"}; path=/; max-age=31536000; samesite=lax`;
    setIsDark(next);
  }

  const label = isDark ? "Switch to light mode" : "Switch to dark mode";
  const glyphClass = iconClassName ?? "h-[18px] w-[18px]";

  return (
    <button
      type="button"
      onClick={toggle}
      title={label}
      aria-label={label}
      className={
        className ??
        "inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      }
    >
      {isDark ? (
        <Sun className={glyphClass} aria-hidden="true" />
      ) : (
        <Moon className={glyphClass} aria-hidden="true" />
      )}
    </button>
  );
}
