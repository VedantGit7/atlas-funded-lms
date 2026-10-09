import { z } from "zod";

export const PricingModelSchema = z.enum(["pay_per_course", "subscription", "cohort", "free"]);

/** ISO 4217 three-letter currency code, e.g. "INR", "USD". */
export const CurrencyCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "Currency must be a 3-letter ISO code.");

export const GstConfigSchema = z.object({
  enabled: z.boolean(),
  number: z.string().nullable(),
  percentage: z.number().nullable(),
});

export const InvoiceConfigSchema = z.object({
  prefix: z.string().nullable(),
  nextNumber: z.number().int().nullable(),
  businessName: z.string().nullable(),
});

export const LearnerCheckoutConfigSchema = z.object({
  requestBillingAddress: z.boolean(),
  requestShippingAddress: z.boolean(),
  requestGstin: z.boolean(),
  requestMobile: z.boolean(),
});

export const LearnerBillingConfigResponseSchema = z.object({
  data: z.object({
    pricingModel: PricingModelSchema.nullable(),
    homeCurrency: z.string().nullable(),
    gst: GstConfigSchema,
    invoice: InvoiceConfigSchema,
    learnerConfig: LearnerCheckoutConfigSchema,
    updatedAt: z.iso.datetime().nullable(),
  }),
});

export const UpdateLearnerConfigRequestSchema = LearnerCheckoutConfigSchema;

/**
 * A GSTIN is exactly 15 characters: a 2-digit state code, the holder's 10-character
 * PAN, a 1-character entity number, the literal "Z", and a checksum character.
 */
export const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const GSTIN_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * The GSTIN check digit, which the pattern alone cannot catch.
 *
 * The last character is a mod-36 checksum over the first fourteen. A regex
 * accepts a transposed pair or a mistyped digit; this does not — and the number
 * is printed on learner invoices, where a wrong one makes the tax
 * unclaimable by the buyer.
 */
export function hasValidGstinChecksum(value: string): boolean {
  if (value.length !== 15) return false;
  let sum = 0;
  for (let index = 0; index < 14; index += 1) {
    const digit = GSTIN_ALPHABET.indexOf(value[index] ?? "");
    if (digit < 0) return false;
    // Alternating weights of 1 and 2, carrying the overflow back in.
    const product = digit * (index % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / GSTIN_ALPHABET.length) + (product % GSTIN_ALPHABET.length);
  }
  const expected = (GSTIN_ALPHABET.length - (sum % GSTIN_ALPHABET.length)) % GSTIN_ALPHABET.length;
  return GSTIN_ALPHABET[expected] === value[14];
}

export function isValidGstin(value: string): boolean {
  const normalised = value.trim().toUpperCase();
  return GSTIN_PATTERN.test(normalised) && hasValidGstinChecksum(normalised);
}

export const UpdateGstRequestSchema = z
  .object({
    enabled: z.boolean(),
    number: z.string().trim().toUpperCase().max(50).nullable(),
    percentage: z.number().min(0).max(100).nullable(),
  })
  .superRefine((value, ctx) => {
    // Turning GST on without the two fields that make it work used to be
    // accepted: the flag went true, checkout added 0%, and invoices carried no
    // GSTIN. Tax is either configured or off — there is no half-on.
    if (!value.enabled) return;

    if (value.number === null || value.number === "") {
      ctx.addIssue({
        code: "custom",
        path: ["number"],
        message: "A GSTIN is required to enable GST.",
      });
    } else if (!isValidGstin(value.number)) {
      ctx.addIssue({
        code: "custom",
        path: ["number"],
        message: "This is not a valid GSTIN.",
      });
    }

    if (value.percentage === null) {
      ctx.addIssue({
        code: "custom",
        path: ["percentage"],
        message: "A GST percentage is required to enable GST.",
      });
    } else if (value.percentage <= 0) {
      // Checkout treats a zero or negative rate as no tax at all, so saving one
      // while the toggle reads "enabled" would be a lie on this screen.
      ctx.addIssue({
        code: "custom",
        path: ["percentage"],
        message: "A GST percentage above 0 is required to enable GST.",
      });
    }
  });

/**
 * The invoice-number allocator keeps only these characters and only this many
 * of them (`allocateInvoiceNumber` in order-fulfillment.service.ts). The schema
 * enforces the same limits so that what an admin types is what gets printed —
 * previously a 20-character prefix or one containing a space or a full stop
 * saved happily and was then silently cut down at allocation time.
 */
export const INVOICE_PREFIX_MAX_LENGTH = 16;
export const INVOICE_PREFIX_PATTERN = /^[A-Za-z0-9_-]+$/;

/** How many digits the sequence is padded to on a real invoice. */
export const INVOICE_SEQUENCE_PAD = 5;

/**
 * The number a given prefix and sequence actually produce.
 *
 * Note the separating hyphen the allocator inserts: a prefix of "INV-" yields
 * "INV--00001", not "INV-1". Anything previewing an invoice number has to use
 * this rather than concatenating, or it shows a number that will never exist.
 */
export function formatInvoiceNumber(prefix: string, sequence: number): string {
  return `${prefix}-${String(sequence).padStart(INVOICE_SEQUENCE_PAD, "0")}`;
}

export const UpdateInvoiceRequestSchema = z.object({
  prefix: z
    .string()
    .trim()
    .min(1)
    .max(
      INVOICE_PREFIX_MAX_LENGTH,
      `A prefix can be at most ${INVOICE_PREFIX_MAX_LENGTH} characters.`,
    )
    .regex(
      INVOICE_PREFIX_PATTERN,
      "A prefix can use only letters, numbers, hyphens and underscores.",
    ),
  nextNumber: z.number().int().min(1).max(1_000_000_000),
  businessName: z.string().trim().min(1).max(200),
});

export const BillingLocationViewSchema = z.object({
  id: z.string(),
  title: z.string(),
  locationKey: z.string(),
  currency: z.string(),
  description: z.string().nullable(),
  status: z.string(),
  isDefault: z.boolean(),
  updatedAt: z.iso.datetime(),
});

export const BillingLocationListResponseSchema = z.object({
  data: z.array(BillingLocationViewSchema),
});

export const AddBillingLocationRequestSchema = z.object({
  locationKey: z.string().trim().min(1).max(10),
  title: z.string().trim().min(1).max(120),
  currency: CurrencyCodeSchema,
  description: z.string().trim().max(150).nullable().optional(),
});

export const UpdatePricingModelRequestSchema = z.object({
  pricingModel: PricingModelSchema,
});

export const UpdateHomeCurrencyRequestSchema = z.object({
  currency: CurrencyCodeSchema,
});

export type PricingModel = z.infer<typeof PricingModelSchema>;
export type LearnerBillingConfigResponse = z.infer<typeof LearnerBillingConfigResponseSchema>;
export type UpdatePricingModelRequest = z.infer<typeof UpdatePricingModelRequestSchema>;
export type UpdateHomeCurrencyRequest = z.infer<typeof UpdateHomeCurrencyRequestSchema>;
export type UpdateGstRequest = z.infer<typeof UpdateGstRequestSchema>;
export type UpdateInvoiceRequest = z.infer<typeof UpdateInvoiceRequestSchema>;
export type LearnerCheckoutConfig = z.infer<typeof LearnerCheckoutConfigSchema>;
export type UpdateLearnerConfigRequest = z.infer<typeof UpdateLearnerConfigRequestSchema>;
export type BillingLocationView = z.infer<typeof BillingLocationViewSchema>;
export type BillingLocationListResponse = z.infer<typeof BillingLocationListResponseSchema>;
export type AddBillingLocationRequest = z.infer<typeof AddBillingLocationRequestSchema>;
