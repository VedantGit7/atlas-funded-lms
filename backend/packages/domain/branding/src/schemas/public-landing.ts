import { z } from "zod";

export const PublicLandingSlugParamsSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/),
});

export const PublicLandingCtaSchema = z.object({
  label: z.string().min(1).max(120),
  href: z.string().min(1).max(300),
});

export const PublicLandingCopySchema = z.object({
  headline: z.string().max(200).optional(),
  subheadline: z.string().max(500).optional(),
  trustProof: z.string().max(300).optional(),
  footerText: z.string().max(500).optional(),
  featuredCredentialId: z.string().max(120).optional(),
  primaryCta: PublicLandingCtaSchema.optional(),
});

export const PublicLandingPageSchema = z.object({
  slug: z.string(),
  publicName: z.string().nullable(),
  issuerName: z.string().nullable(),
  headline: z.string(),
  subheadline: z.string().nullable(),
  trustProof: z.string().nullable(),
  primaryCta: PublicLandingCtaSchema,
  secondaryCtas: z.array(PublicLandingCtaSchema),
  featuredVerifyHref: z.string().nullable(),
  footerText: z.string().nullable(),
});

export const PublicLandingResponseSchema = z.object({
  data: PublicLandingPageSchema,
});

export type PublicLandingCopy = z.infer<typeof PublicLandingCopySchema>;
export type PublicLandingPage = z.infer<typeof PublicLandingPageSchema>;
