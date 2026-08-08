import type { CSSProperties } from "react";
import { loadPublicBootstrap } from "./bootstrap";

export type TenantThemeRuntime = {
  style: CSSProperties | null;
  modeDefault: "system" | "light" | "dark";
};

export async function loadTenantThemeRuntime(): Promise<TenantThemeRuntime> {
  try {
    const bootstrap = await loadPublicBootstrap();

    if (!bootstrap.tenantId || bootstrap.tenantState !== "ACTIVE") {
      return { style: null, modeDefault: "system" };
    }

    if (!bootstrap.themeCssVars) {
      return { style: null, modeDefault: bootstrap.modeDefault ?? "system" };
    }

    return {
      style: bootstrap.themeCssVars,
      modeDefault: bootstrap.modeDefault ?? "system",
    };
  } catch {
    return { style: null, modeDefault: "system" };
  }
}
