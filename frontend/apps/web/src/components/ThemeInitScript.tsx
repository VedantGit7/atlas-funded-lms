import {
  ATLAS_UI_ACCENT_COOKIE,
  ATLAS_UI_FONT_SCALE_COOKIE,
  ATLAS_UI_HIGH_CONTRAST_COOKIE,
  ATLAS_UI_MODE_COOKIE,
  ATLAS_UI_REDUCED_MOTION_COOKIE,
} from "../lib/auth-cookies";

type ThemeInitScriptProps = {
  /** Tenant's configured fallback, used only when no personal cookie exists yet. */
  tenantModeDefault: "system" | "light" | "dark";
};

function buildThemeInitScript(tenantModeDefault: "system" | "light" | "dark"): string {
  return `
(function () {
  try {
    var root = document.documentElement;
    var read = function (name) {
      var m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
      return m ? decodeURIComponent(m[1]) : null;
    };

    var mode = read("${ATLAS_UI_MODE_COOKIE}") || "${tenantModeDefault}";
    var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (mode === "dark" || (mode === "system" && prefersDark)) {
      root.classList.add("dark");
    }

    var accent = read("${ATLAS_UI_ACCENT_COOKIE}");
    if (accent) {
      root.style.setProperty("--user-accent", accent);
    }

    var scale = read("${ATLAS_UI_FONT_SCALE_COOKIE}");
    if (scale) {
      root.style.setProperty("--user-font-scale", scale);
    }

    if (read("${ATLAS_UI_REDUCED_MOTION_COOKIE}") === "1") {
      root.classList.add("reduce-motion");
    }

    if (read("${ATLAS_UI_HIGH_CONTRAST_COOKIE}") === "1") {
      root.classList.add("high-contrast");
    }
  } catch (e) {}
})();
`;
}

/**
 * Must render before body content to avoid a flash of the wrong light/dark
 * mode, accent, text size, reduced-motion, or high-contrast state on first
 * paint. Resolves purely from client-readable cookies + prefers-color-scheme —
 * no DB round-trip.
 */
export function ThemeInitScript({ tenantModeDefault }: ThemeInitScriptProps) {
  return (
    <script dangerouslySetInnerHTML={{ __html: buildThemeInitScript(tenantModeDefault) }} />
  );
}
