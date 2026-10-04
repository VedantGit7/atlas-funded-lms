/**
 * Where tenant code snippets may run (audit H5).
 *
 * Snippets are arbitrary HTML and script from tenant marketing settings,
 * executed in the app's own origin. They are for public and learner pages
 * (tracking pixels, chat widgets). They must never run where staff work, nor
 * on any page that collects credentials: Supabase accounts span tenants, so a
 * password typed into one tenant's sign-in page also opens that person's
 * account everywhere else.
 *
 * Every top-level route must be listed in exactly one of these sets;
 * tests/lint-rules/marketing-snippet-scope.structure.test.ts enforces it, so a
 * new staff or credential area cannot default to running tenant code.
 */
export const SNIPPET_BLOCKED_ROOTS = [
  // Staff and operator areas.
  "admin",
  "studio",
  "platform",
  "moderate",
  "review",
  // Credential and session pages.
  "login",
  "signup",
  "reset-password",
  "invite",
  "auth",
  "verify-email",
  // Account security (password, MFA, sessions).
  "profile",
  "settings",
] as const;

export const SNIPPET_ALLOWED_ROOTS = [
  "",
  "courses",
  "paths",
  "assessments",
  "attempts",
  "polls",
  "roadmap",
  "f",
  "p",
  "events",
  "affiliate",
  "diagnostic",
  "verify",
  "privacy",
  "terms",
  "tenant-unavailable",
  "achievements",
  "certificates",
  "community",
  "hall-of-fame",
  "help",
  "leaderboards",
  "newsfeed",
  "notifications",
  "practice",
  "progress",
  "readiness",
  "resources",
  "search",
  "swipe",
] as const;

const blocked = new Set<string>(SNIPPET_BLOCKED_ROOTS);
const allowed = new Set<string>(SNIPPET_ALLOWED_ROOTS);

/** Deny unless the first path segment is known to be public or learner-facing. */
export function snippetsAllowedOn(pathname: string): boolean {
  const root = pathname.split("/")[1] ?? "";
  return !blocked.has(root) && allowed.has(root);
}

/**
 * Signup tracking fires on the first page after signup completes, never beside
 * the password field. Destinations reached after a completed signup carry this
 * marker; the snippet injector consumes it.
 */
export const SIGNUP_COMPLETE_PARAM = "signupComplete";

export function withSignupCompleteMarker(path: string): string {
  const [base = "/", hash] = path.split("#", 2);
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}${SIGNUP_COMPLETE_PARAM}=1${hash === undefined ? "" : `#${hash}`}`;
}
