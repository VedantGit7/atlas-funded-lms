import { AtlasHttpError } from "@atlas/core/http/errors";

/**
 * Reject cross-origin state-changing requests.
 *
 * Audit finding H20: cookies are correctly `httpOnly`, `secure` and
 * `sameSite: "lax"` with no `domain` attribute, but SameSite is evaluated
 * against the REGISTRABLE DOMAIN, not the hostname. With tenants on subdomains
 * of a shared base domain, `tenant-a.atlas.com` and `tenant-b.atlas.com` are
 * same-site, so `Lax` happily attaches tenant B's cookies to a state-changing
 * request issued from a page on tenant A.
 *
 * That matters here because tenant admins can legitimately inject JavaScript on
 * their own subdomain (marketing tracking snippets are a designed feature) and
 * rich-text HTML is rendered unsanitised. Tenants on genuine custom domains are
 * cross-site and were already protected; the shared-subdomain default — the
 * onboarding path for every new tenant — was not.
 *
 * Why a missing Origin is allowed:
 *
 * CSRF is a browser attack; it depends on the browser attaching cookies
 * automatically. Modern browsers always send `Origin` on non-GET requests. A
 * request with no `Origin` therefore is not a browser-driven CSRF attempt, and
 * rejecting it would break legitimate non-browser clients (mobile app, scripts,
 * server-to-server callers) for no security gain.
 *
 * Why the port is not compared:
 *
 * `host` here is the resolved tenant host, and tenant resolution strips the
 * port (`normalizeHost`), so it never carries one. Comparing `URL.host` — which
 * does carry the port — against it therefore rejected every browser mutation
 * served on a non-default port, which is every request in local development.
 * Nothing was gained by it either: cookies are not scoped by port, so an origin
 * on the same hostname and a different port already receives the same cookies
 * and is not a distinct principal this guard can separate. Tenants are
 * distinguished by hostname, so hostname is what gets compared.
 */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function assertSameOrigin(args: {
  method: string;
  origin: string | null;
  host: string;
}): void {
  if (SAFE_METHODS.has(args.method.toUpperCase())) {
    return;
  }

  if (!args.origin) {
    return;
  }

  let originHostname: string;
  try {
    originHostname = new URL(args.origin).hostname;
  } catch {
    throw new AtlasHttpError({
      code: "PERMISSION_DENIED",
      status: 403,
      message: "Invalid origin.",
    });
  }

  // `args.host` is already port-free; strip one defensively in case a caller
  // ever passes a raw Host header.
  const expected = (args.host.split(":")[0] ?? "").toLowerCase();
  if (originHostname.toLowerCase() !== expected) {
    throw new AtlasHttpError({
      code: "PERMISSION_DENIED",
      status: 403,
      message: "Invalid origin.",
    });
  }
}
