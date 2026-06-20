import { z } from "zod";

const htmlTagPattern = /<[^>]*>/g;
const scriptPattern = /javascript:/i;

export function sanitizeLocalePlainText(value: string): string {
  return value.replace(htmlTagPattern, "").replace(scriptPattern, "").trim();
}

export const localeCodeSchema = z
  .string()
  .min(2)
  .max(16)
  .regex(/^[a-z]{2}([-_][A-Z]{2})?$/);

export const localeResourceKeySchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-z][a-z0-9._-]*$/);

export const localeResourceValueSchema = z
  .string()
  .min(1)
  .max(4000)
  .transform(sanitizeLocalePlainText)
  .refine((value) => value.length > 0, "Locale value is required")
  .refine((value) => !scriptPattern.test(value), "Locale value must be plain text");

export const localeResourceDtoSchema = z.object({
  locale: localeCodeSchema,
  key: localeResourceKeySchema,
  value: localeResourceValueSchema,
  updatedAt: z.string().datetime(),
});

export const localeResourceListResponseSchema = z.object({
  data: z.array(localeResourceDtoSchema),
});

export const localeResourceUpsertItemSchema = z
  .object({
    key: localeResourceKeySchema,
    value: localeResourceValueSchema,
  })
  .strict();

export const upsertLocaleResourcesBodySchema = z
  .object({
    resources: z.array(localeResourceUpsertItemSchema).min(1).max(500),
  })
  .strict()
  .superRefine((value, ctx) => {
    const keys = value.resources.map((resource) => resource.key);
    const unique = new Set(keys);
    if (unique.size !== keys.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Duplicate locale keys in request body.",
        path: ["resources"],
      });
    }
  })
  .and(
    z
      .object({
        tenant_id: z.never().optional(),
        tenantId: z.never().optional(),
      })
      .passthrough(),
  );

export const localeResourceUpsertResponseSchema = z.object({
  data: z.array(localeResourceDtoSchema),
});

export type UpsertLocaleResourcesBody = z.infer<typeof upsertLocaleResourcesBodySchema>;
