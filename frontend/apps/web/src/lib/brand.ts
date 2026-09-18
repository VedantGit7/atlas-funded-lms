/**
 * Tenant logo resolution.
 *
 * There is deliberately no platform logo constant here any more.
 * `/brand/avatar-gradient.svg` is FundedBeyond's mark (gradient disc + white FB
 * monogram), and exporting it as a shared default is what put tenant #1's
 * monogram on every academy's admin, studio, auth, loading, verify-email and
 * certificate-builder screens. `atlas/no-hardcoded-tenant-strings` could not
 * catch it: the rule inspects string literals, and this was an identifier.
 *
 * A tenant with no uploaded logo gets an initials mark derived from their own
 * name — render `<TenantBrandMark />` rather than resolving a URL yourself.
 */

type BrandingLogos = {
  logoLightUrl?: string | null;
  logoDarkUrl?: string | null;
};

/**
 * The tenant's own logo for the requested variant, or `null` when they have not
 * uploaded one. `null` means "render the initials mark", never "substitute
 * another tenant's asset".
 */
export function resolveTenantLogoUrl(
  branding: BrandingLogos | null | undefined,
  variant: "light" | "dark" = "light",
): string | null {
  const preferred = variant === "dark" ? branding?.logoDarkUrl : branding?.logoLightUrl;
  const other = variant === "dark" ? branding?.logoLightUrl : branding?.logoDarkUrl;
  return preferred ?? other ?? null;
}
