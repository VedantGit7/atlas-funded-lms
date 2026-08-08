import {
  PublicLandingCopySchema,
  PublicLandingCtaSchema,
  type PublicLandingCopy,
  type PublicLandingPage,
} from "../schemas/public-landing";

const DEFAULT_PRIMARY_CTA = PublicLandingCtaSchema.parse({
  label: "Start diagnostic",
  href: "/diagnostic",
});

const DEFAULT_SECONDARY_CTAS = [
  PublicLandingCtaSchema.parse({ label: "Sign in", href: "/login" }),
  PublicLandingCtaSchema.parse({ label: "Create account", href: "/signup" }),
];

const DEFAULT_SUBHEADLINE =
  "Explore diagnostic assessment, sign in to continue learning, or create an account to join this academy.";

export function resolvePublicLandingCopy(
  raw: Record<string, unknown> | null,
  slug: string,
): PublicLandingCopy | null {
  if (!raw) {
    return slug === "home" ? {} : null;
  }

  const slugEntry = raw[slug];
  if (slugEntry && typeof slugEntry === "object" && !Array.isArray(slugEntry)) {
    const parsed = PublicLandingCopySchema.safeParse(slugEntry);
    return parsed.success ? parsed.data : null;
  }

  if (slug === "home" && typeof raw["headline"] === "string") {
    const parsed = PublicLandingCopySchema.safeParse(raw);
    return parsed.success ? parsed.data : {};
  }

  if (slug === "home") {
    return {};
  }

  return null;
}

export function buildPublicLandingPage(args: {
  slug: string;
  publicName: string | null;
  issuerName: string | null;
  copy: PublicLandingCopy | null;
}): PublicLandingPage {
  const copy = args.copy ?? {};
  const headline = copy.headline ?? args.publicName ?? "Welcome";
  const featuredCredentialId = copy.featuredCredentialId?.trim() || null;

  return {
    slug: args.slug,
    publicName: args.publicName,
    issuerName: args.issuerName,
    headline,
    subheadline: copy.subheadline ?? DEFAULT_SUBHEADLINE,
    trustProof: copy.trustProof ?? null,
    primaryCta: copy.primaryCta ?? DEFAULT_PRIMARY_CTA,
    secondaryCtas: DEFAULT_SECONDARY_CTAS,
    featuredVerifyHref: featuredCredentialId ? `/verify/${featuredCredentialId}` : null,
    footerText: copy.footerText ?? null,
  };
}
