import { z } from "zod";

/**
 * Tenant-supplied legal documents (Terms, Privacy Policy).
 *
 * These used to be module constants in the web app
 * (`features/public/components/legal/terms-content.ts` and `privacy-content.ts`)
 * holding tenant #1's text, which meant every academy on the platform served
 * FundedBeyond's Terms and Privacy Policy from its own domain. The documents
 * are now tenant configuration: each tenant supplies their own, and a tenant
 * that has not published one gets an explicit "not published" state rather
 * than somebody else's agreement.
 */
export const LegalContentBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("p"), text: z.string() }),
  z.object({ type: z.literal("h3"), text: z.string() }),
  z.object({ type: z.literal("ul"), items: z.array(z.string()) }),
  z.object({ type: z.literal("ol"), items: z.array(z.string()) }),
  z.object({
    type: z.literal("table"),
    headers: z.array(z.string()),
    rows: z.array(z.array(z.string())),
  }),
]);

export const LegalSectionSchema = z.object({
  id: z.string().min(1),
  sectionNumber: z.string(),
  title: z.string(),
  blocks: z.array(LegalContentBlockSchema),
});

export const LEGAL_DOCUMENT_SLUGS = ["terms", "privacy"] as const;

export const LegalDocumentSlugSchema = z.enum(LEGAL_DOCUMENT_SLUGS);

export const LegalDocumentSchema = z.object({
  slug: LegalDocumentSlugSchema,
  title: z.string().min(1),
  subtitle: z.string(),
  lastUpdated: z.string(),
  sections: z.array(LegalSectionSchema),
});

/** `document` is null when this tenant has not published that document. */
export const PublicLegalDocumentResponseSchema = z.object({
  data: z.object({
    document: LegalDocumentSchema.nullable(),
  }),
});

export type LegalContentBlock = z.infer<typeof LegalContentBlockSchema>;
export type LegalSection = z.infer<typeof LegalSectionSchema>;
export type LegalDocument = z.infer<typeof LegalDocumentSchema>;
export type LegalDocumentSlug = z.infer<typeof LegalDocumentSlugSchema>;
