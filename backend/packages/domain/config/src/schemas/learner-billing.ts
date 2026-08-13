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

export const UpdateGstRequestSchema = z.object({
  enabled: z.boolean(),
  number: z.string().trim().max(50).nullable(),
  percentage: z.number().min(0).max(100).nullable(),
});

export const UpdateInvoiceRequestSchema = z.object({
  prefix: z.string().trim().min(1).max(20),
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
