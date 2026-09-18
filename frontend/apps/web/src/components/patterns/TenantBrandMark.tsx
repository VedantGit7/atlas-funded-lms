import Image from "next/image";

/** Words that carry no tenant identity, so they never contribute an initial. */
const GENERIC_NAME_WORDS =
  /^(academy|academia|institute|school|schools|college|university|training|trainings|education|educational|learning|learn|lms|the|of|and|for)$/i;

/**
 * Up to two initials for a tenant, skipping generic words so
 * "FundedBeyond Academy" reads "FB" rather than "FA".
 *
 * Returns "?" only when there is no usable name at all — callers always render
 * this next to a text label, so it is never the sole identification.
 */
export function tenantInitials(name: string | null | undefined): string {
  const words = (name ?? "")
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);
  const meaningful = words.filter((word) => !GENERIC_NAME_WORDS.test(word));
  const source = meaningful.length > 0 ? meaningful : words;

  const [first, second] = source;
  if (first === undefined) return "?";
  if (second === undefined) {
    // Single word: "Northwind" -> "NO". A CamelCase name gives a nicer pair.
    const camel = /^(\p{Lu}\p{Ll}*)(\p{Lu})/u.exec(first);
    if (camel) {
      const [, lead, next] = camel;
      if (lead !== undefined && next !== undefined) {
        return (lead.slice(0, 1) + next).toUpperCase();
      }
    }
    return first.slice(0, 2).toUpperCase();
  }
  return (first.slice(0, 1) + second.slice(0, 1)).toUpperCase();
}

/**
 * Stable hue per tenant name, so an academy's mark looks the same on every
 * screen and two neighbouring tenants are unlikely to collide.
 */
function hueFromName(name: string): number {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash << 5) - hash + name.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash) % 360;
}

type TenantBrandMarkProps = {
  /** The tenant's uploaded logo, when branding supplies one. */
  logoUrl?: string | null;
  /** Tenant public name — the initials fallback is derived from it. */
  name?: string | null;
  /** Rendered size in pixels (square). */
  size: number;
  className?: string;
};

/**
 * A tenant's logo, or an initials mark derived from their name when they have
 * not uploaded one.
 *
 * This replaces importing a platform logo constant directly. Every shell used
 * to render `/brand/avatar-gradient.svg` — FundedBeyond's monogram — so every
 * academy saw tenant #1's mark on its admin, studio, auth, loading,
 * verify-email and certificate-builder screens.
 *
 * `unoptimized` is deliberate: tenant logo URLs are absolute, per-tenant and
 * may be signed storage URLs, so they cannot be enumerated in
 * `images.remotePatterns` and must not be run through the image optimizer
 * (which would also cache a URL that expires).
 */
export function TenantBrandMark({ logoUrl, name, size, className }: TenantBrandMarkProps) {
  if (logoUrl) {
    return (
      <Image
        src={logoUrl}
        alt=""
        width={size}
        height={size}
        unoptimized
        className={className}
        style={{ width: size, height: size, objectFit: "contain" }}
      />
    );
  }

  const trimmed = (name ?? "").trim();
  const hue = hueFromName(trimmed);

  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-extrabold leading-none text-white ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(9, Math.round(size * 0.38)),
        letterSpacing: "0.01em",
        background: `linear-gradient(135deg, hsl(${hue} 58% 48%), hsl(${(hue + 38) % 360} 62% 34%))`,
      }}
    >
      {tenantInitials(trimmed)}
    </span>
  );
}
