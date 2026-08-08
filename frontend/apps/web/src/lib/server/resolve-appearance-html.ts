import { cookies } from "next/headers";
import type { CSSProperties } from "react";
import {
  ATLAS_UI_ACCENT_COOKIE,
  ATLAS_UI_FONT_SCALE_COOKIE,
  ATLAS_UI_HIGH_CONTRAST_COOKIE,
  ATLAS_UI_MODE_COOKIE,
  ATLAS_UI_REDUCED_MOTION_COOKIE,
} from "../auth-cookies";

type AppearanceHtmlProps = {
  className: string;
  style: CSSProperties | undefined;
};

/**
 * Mirrors client-readable appearance cookies on the server `<html>` element so
 * ThemeInitScript does not introduce hydration mismatches on reload.
 */
export async function resolveAppearanceHtmlProps(
  baseClassName: string,
  baseStyle: CSSProperties | undefined,
  tenantModeDefault: "system" | "light" | "dark",
): Promise<AppearanceHtmlProps> {
  const jar = await cookies();
  const classTokens = new Set(baseClassName.split(/\s+/).filter(Boolean));
  const style: Record<string, string> = {};

  if (baseStyle) {
    for (const [key, value] of Object.entries(baseStyle)) {
      if (value != null) {
        style[key] = String(value);
      }
    }
  }

  const accent = jar.get(ATLAS_UI_ACCENT_COOKIE)?.value;
  if (accent) {
    style["--user-accent"] = accent;
  }

  const fontScale = jar.get(ATLAS_UI_FONT_SCALE_COOKIE)?.value;
  if (fontScale) {
    style["--user-font-scale"] = fontScale;
  }

  if (jar.get(ATLAS_UI_REDUCED_MOTION_COOKIE)?.value === "1") {
    classTokens.add("reduce-motion");
  }

  if (jar.get(ATLAS_UI_HIGH_CONTRAST_COOKIE)?.value === "1") {
    classTokens.add("high-contrast");
  }

  const mode = jar.get(ATLAS_UI_MODE_COOKIE)?.value ?? tenantModeDefault;
  if (mode === "dark") {
    classTokens.add("dark");
  }

  return {
    className: [...classTokens].join(" "),
    style: Object.keys(style).length > 0 ? style : undefined,
  };
}
