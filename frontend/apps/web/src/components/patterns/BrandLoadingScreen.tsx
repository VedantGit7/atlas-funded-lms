import { TenantBrandMark } from "./TenantBrandMark";

type BrandLoadingScreenProps = {
  /** The tenant's own logo, when branding supplies one. */
  logoUrl?: string | null;
  /** Tenant public name — shown as the wordmark and used for the initials mark. */
  tenantName?: string | null;
  /** Accessible status text announced to screen readers. */
  label?: string;
};

/**
 * Site-wide branded loading screen shown while a route segment streams in.
 *
 * Theme-adaptive with zero hardcoded brand values: it prefers the FundedBeyond
 * brand tokens (`--fba-*`) when rendered inside the `.fba-scope` (landing/auth),
 * and gracefully falls back to the app's semantic tokens (`--primary`,
 * `--background`, `--foreground`, `--muted-foreground`) inside the authenticated
 * shells, so it stays correct in tenant light and dark modes alike.
 *
 * Motion (spinner, bouncing dots, entrance reveal) is CSS-only — keyframes live
 * in globals.css and are disabled automatically by `prefers-reduced-motion`.
 */
export function BrandLoadingScreen({
  label = "Loading",
  logoUrl = null,
  tenantName = null,
}: BrandLoadingScreenProps) {
  // The wordmark used to read "FundedBeyond Academy" for every tenant. With no
  // tenant name available this shows nothing rather than someone else's brand.
  const wordmark = tenantName?.trim() ?? "";
  const leadWord = wordmark.replace(/\s*Academy\s*$/i, "") || wordmark;
  const hasAcademySuffix = /academy/i.test(wordmark);

  // This component is usually a route-level `loading.tsx`, i.e. a Suspense
  // fallback: it has to render immediately and cannot await branding, and an
  // async fallback would suspend itself. The root layout therefore publishes
  // the tenant's mark and name as CSS custom properties on <html>, which cost
  // nothing to read here. Props still win when a caller has the data already.
  const usesCssBranding = logoUrl == null && wordmark === "";
  const brand = "var(--fba-ind, var(--primary))";
  const surface = "var(--fba-bg, var(--background))";
  const textPrimary = "var(--fba-tx, var(--foreground))";
  const textMuted = "var(--fba-tx2, var(--muted-foreground))";
  const dotColor = "var(--fba-tx3, var(--muted-foreground))";
  const ringTrack = "var(--fba-bdr, var(--border))";
  const glowSoft = "color-mix(in srgb, var(--fba-ind, var(--primary)) 18%, transparent)";
  const glowBadge = "color-mix(in srgb, var(--fba-ind, var(--primary)) 30%, transparent)";

  return (
    <div
      role="status"
      aria-live="polite"
      className="relative flex min-h-[70vh] w-full flex-col items-center justify-center overflow-hidden px-6 py-16"
      style={{ backgroundColor: surface }}
    >
      {/* Atmospheric brand glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-20">
        <div
          className="absolute -left-[10%] -top-[10%] h-[40%] w-[40%] rounded-full blur-[120px]"
          style={{ backgroundColor: glowSoft }}
        />
        <div
          className="absolute -bottom-[10%] -right-[10%] h-[30%] w-[30%] rounded-full blur-[100px]"
          style={{ backgroundColor: glowSoft }}
        />
      </div>

      <div className="fba-loader-reveal relative z-10 flex flex-col items-center gap-10">
        <div className="relative flex h-[76px] w-[76px] items-center justify-center">
          <span
            aria-hidden
            className="absolute inset-0 rounded-full border-[3px]"
            style={{ borderColor: ringTrack }}
          />
          <span
            aria-hidden
            className="fba-loader-spin absolute inset-0 rounded-full border-[3px] border-transparent"
            style={{ borderTopColor: brand }}
          />
          {usesCssBranding ? (
            // `--tenant-logo-url` is set by the root layout only when the tenant
            // has a logo, so an unbranded tenant falls back to `none` and this
            // renders as an empty disc behind the spinner rather than a broken
            // image or someone else's mark.
            <span
              aria-hidden
              className="flex h-[52px] w-[52px] items-center justify-center rounded-full"
              style={{
                boxShadow: `0 12px 28px -6px ${glowBadge}`,
                // Inline rather than a Tailwind arbitrary value: this has to
                // work regardless of whether the utility survived the content
                // scan, and the fallback keeps an unbranded tenant blank.
                backgroundImage: "var(--tenant-logo-url, none)",
                backgroundSize: "contain",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }}
            />
          ) : (
            <span
              aria-hidden
              className="flex h-[52px] w-[52px] items-center justify-center rounded-full"
              style={{ boxShadow: `0 12px 28px -6px ${glowBadge}` }}
            >
              <TenantBrandMark
                logoUrl={logoUrl}
                name={wordmark}
                size={52}
                className="h-[52px] w-[52px] rounded-full"
              />
            </span>
          )}
        </div>

        <div className="flex flex-col items-center gap-6">
          {wordmark ? (
            <p className="flex items-center gap-1.5 text-[15px] tracking-tight">
              <span className="font-extrabold" style={{ color: textPrimary }}>
                {leadWord}
              </span>
              {hasAcademySuffix ? (
                <span className="font-medium" style={{ color: textMuted }}>
                  Academy
                </span>
              ) : null}
            </p>
          ) : null}
          <div className="flex items-center gap-2" aria-hidden>
            {[0, 1, 2].map((index) => (
              <span
                key={index}
                className="fba-loader-dot h-[6px] w-[6px] rounded-full"
                style={{ backgroundColor: dotColor, animationDelay: `${index * 0.2}s` }}
              />
            ))}
          </div>
        </div>
      </div>

      <span className="sr-only">{label}</span>
    </div>
  );
}
