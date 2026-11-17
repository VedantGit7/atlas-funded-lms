import type { CSSProperties } from "react";
import { loadPublicBootstrap } from "./bootstrap";

/**
 * The academy's look beyond its colours (TenantThemeTokensSchema.skin).
 * "classic" is the standard palette; "sky-glass" restyles every surface
 * (src/styles/skins/sky-glass.css).
 */
export type TenantThemeSkin = "classic" | "sky-glass";

export type TenantThemeRuntime = {
  style: CSSProperties | null;
  modeDefault: "system" | "light" | "dark";
  skin: TenantThemeSkin;
};

/** Only a known skin is applied; anything else reads as classic. */
export function readThemeSkin(themeTokens: unknown): TenantThemeSkin {
  const skin =
    typeof themeTokens === "object" && themeTokens !== null
      ? (themeTokens as { skin?: unknown }).skin
      : undefined;
  return skin === "sky-glass" ? "sky-glass" : "classic";
}

export async function loadTenantThemeRuntime(): Promise<TenantThemeRuntime> {
  try {
    const bootstrap = await loadPublicBootstrap();

    if (!bootstrap.tenantId || bootstrap.tenantState !== "ACTIVE") {
      return { style: null, modeDefault: "system", skin: "classic" };
    }

    const skin = readThemeSkin(bootstrap.themeTokens);

    if (!bootstrap.themeCssVars) {
      return { style: null, modeDefault: bootstrap.modeDefault ?? "system", skin };
    }

    return {
      style: bootstrap.themeCssVars,
      modeDefault: bootstrap.modeDefault ?? "system",
      skin,
    };
  } catch {
    return { style: null, modeDefault: "system", skin: "classic" };
  }
}
