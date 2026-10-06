import { AtlasHttpError } from "@atlas/core/http/errors";
import { normalizeHost, resolveRequestHostFromHeaders } from "@atlas/tenancy";

/**
 * Where an auth email or an OAuth provider sends the user back to (audit, low:
 * `emailRedirectTo`).
 *
 * Signup, magic-link, resend and email-change emails, and OAuth sign-in and
 * identity linking, carry a caller-chosen URL that Supabase puts in the link or
 * the provider redirect. Any URL used to be accepted, so a crafted request
 * could send a genuine Atlas email whose link lands the reader, with a fresh
 * session token in the URL fragment, on another tenant's domain or an
 * attacker's site. Supabase's redirect allow-list is the only other check, and
 * a wildcard there would let it through.
 *
 * The URL must now point at the host the request came from: the tenant domain
 * or platform host the user is on (the web app builds these URLs from its own
 * origin, so legitimate requests always match). Plain http and explicit ports
 * are accepted only on development hostnames (`*.localhost`, `*.test`), which
 * no public domain can use.
 */
export type RedirectField = "emailRedirectTo" | "redirectTo";

function isDevelopmentHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".test");
}

function invalidRedirect(field: RedirectField): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message: `${field} must be a page on this site.`,
  });
}

export function assertRedirectOnRequestHost(args: {
  value: string;
  requestHost: string;
  field: RedirectField;
}): string {
  let url: URL;
  try {
    url = new URL(args.value);
  } catch {
    throw invalidRedirect(args.field);
  }

  const hostname = url.hostname.toLowerCase();
  const development = isDevelopmentHostname(hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && development)) {
    throw invalidRedirect(args.field);
  }
  if (url.username || url.password || (url.port && !development)) {
    throw invalidRedirect(args.field);
  }

  let requestHost: string;
  try {
    requestHost = normalizeHost(args.requestHost);
  } catch {
    throw invalidRedirect(args.field);
  }
  if (hostname !== requestHost) {
    throw invalidRedirect(args.field);
  }
  return url.toString();
}

/** The same check for public routes, which hold the request. */
export function assertRedirectOnRequestHostFrom(
  headers: Headers,
  value: string,
  field: RedirectField,
): string {
  let requestHost: string;
  try {
    requestHost = resolveRequestHostFromHeaders(headers);
  } catch {
    throw invalidRedirect(field);
  }
  return assertRedirectOnRequestHost({ value, requestHost, field });
}
