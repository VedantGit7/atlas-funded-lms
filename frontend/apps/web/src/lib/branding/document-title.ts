/**
 * Browser tab / document title for tenant hosts.
 *
 * Tenant hosts must never fall back to the platform product name ("Atlas LMS").
 * Format is always "{TenantName} LMS". Trailing "Academy" / "LMS" on the public
 * name are stripped so we do not produce "FundedBeyond Academy LMS".
 */

export type TenantTitleSource = {
  tenantId?: string | null;
  publicName?: string | null;
  issuerName?: string | null;
  tenantSlug?: string | null;
};

const PLATFORM_DEFAULT_TITLE = "Atlas LMS";

function stripProductSuffix(name: string): string {
  return name.replace(/\s+(Academy|LMS)\s*$/i, "").trim() || name.trim();
}

function humanizeSlug(slug: string): string {
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Returns the tab title for the current host.
 * - Tenant host with a resolvable name → "{Name} LMS"
 * - Platform / unresolved → "Atlas LMS"
 */
export function resolveDocumentTitle(source: TenantTitleSource): string {
  if (!source.tenantId) {
    return PLATFORM_DEFAULT_TITLE;
  }

  const fromPublic = source.publicName?.trim();
  const fromIssuer = source.issuerName?.trim();
  const fromSlug = source.tenantSlug?.trim() ? humanizeSlug(source.tenantSlug.trim()) : "";

  const raw = fromPublic || fromIssuer || fromSlug;
  if (!raw) {
    // Tenant is known but branding names are empty — still avoid the platform title.
    return "Academy LMS";
  }

  return `${stripProductSuffix(raw)} LMS`;
}

export function resolveDocumentDescription(source: TenantTitleSource): string {
  const title = resolveDocumentTitle(source);
  if (title === PLATFORM_DEFAULT_TITLE) {
    return "Atlas LMS application shell";
  }
  return `${title.replace(/\s+LMS$/i, "")} learning platform`;
}

/** Admin shell home — brand mark / wordmark must always navigate here. */
export const ADMIN_DASHBOARD_HREF = "/admin" as const;
