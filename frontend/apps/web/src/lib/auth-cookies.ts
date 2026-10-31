export const ATLAS_ACCESS_TOKEN_COOKIE = "atlas_access_token";
export const ATLAS_REFRESH_TOKEN_COOKIE = "atlas_refresh_token";
export const ATLAS_SESSION_PERSISTENT_COOKIE = "atlas_session_persistent";
export const ATLAS_UI_MODE_COOKIE = "atlas_ui_mode";
/**
 * Better Auth's session cookie, in place of the access and refresh cookies
 * when the API runs Better Auth (docs/engineering/better-auth-design.md).
 * Opaque: its expiry can't be read here, so the API's 401 decides.
 */
export const ATLAS_SESSION_COOKIE = "atlas_session";
export const ATLAS_SECURE_SESSION_COOKIE = `__Secure-${ATLAS_SESSION_COOKIE}`;
/**
 * Client-readable personal appearance/accessibility cookies. They mirror the
 * server-of-record (`member_profiles.metadata_json`) so `ThemeInitScript` can
 * restore them before first paint without a DB round-trip (no theme flash).
 */
export const ATLAS_UI_ACCENT_COOKIE = "atlas_ui_accent";
export const ATLAS_UI_FONT_SCALE_COOKIE = "atlas_ui_font_scale";
export const ATLAS_UI_REDUCED_MOTION_COOKIE = "atlas_ui_reduced_motion";
export const ATLAS_UI_HIGH_CONTRAST_COOKIE = "atlas_ui_high_contrast";
