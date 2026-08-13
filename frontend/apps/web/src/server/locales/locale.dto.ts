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

export const localeReviewStatusSchema = z.enum(["pending", "approved", "rejected"]);

export const localeResourceDtoSchema = z.object({
  locale: localeCodeSchema,
  key: localeResourceKeySchema,
  value: localeResourceValueSchema,
  updatedAt: z.iso.datetime(),
  reviewStatus: localeReviewStatusSchema.optional(),
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
    tenant_id: z.never().optional(),
    tenantId: z.never().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const keys = value.resources.map((resource) => resource.key);
    const unique = new Set(keys);
    if (unique.size !== keys.length) {
      ctx.addIssue({
        code: "custom",
        message: "Duplicate locale keys in request body.",
        path: ["resources"],
      });
    }
  });

export const localeResourceUpsertResponseSchema = z.object({
  data: z.array(localeResourceDtoSchema),
});

export const deleteLocaleResourceResponseSchema = z.object({
  data: z.object({
    locale: localeCodeSchema,
    key: localeResourceKeySchema,
    deleted: z.literal(true),
  }),
});

export const localeMetadataDtoSchema = z.object({
  locale: localeCodeSchema,
  nativeName: z.string().min(1).max(128).nullable(),
  isRtl: z.boolean(),
  isDefault: z.boolean(),
  isFallback: z.boolean(),
  updatedAt: z.iso.datetime(),
});

export const localeMetadataListResponseSchema = z.object({
  data: z.array(localeMetadataDtoSchema),
});

export const upsertLocaleMetadataBodySchema = z
  .object({
    nativeName: z.string().min(1).max(128).nullable().optional(),
    isRtl: z.boolean().optional(),
    isDefault: z.boolean().optional(),
    isFallback: z.boolean().optional(),
    tenant_id: z.never().optional(),
    tenantId: z.never().optional(),
  })
  .strict();

export const localeMetadataUpsertResponseSchema = z.object({
  data: localeMetadataDtoSchema,
});

export const localeMetadataDeleteResponseSchema = z.object({
  data: z.object({
    locale: localeCodeSchema,
    deleted: z.literal(true),
  }),
});

export const localeCanonicalKeyDtoSchema = z.object({
  key: localeResourceKeySchema,
  sourceLocale: localeCodeSchema,
  description: z.string().max(512).nullable(),
  updatedAt: z.iso.datetime(),
});

export const localeCanonicalKeyListResponseSchema = z.object({
  data: z.array(localeCanonicalKeyDtoSchema),
});

export const localeCoverageEntrySchema = z.object({
  locale: localeCodeSchema,
  totalCanonicalKeys: z.number().int().nonnegative(),
  translatedCount: z.number().int().nonnegative(),
  coveragePercent: z.number().min(0).max(100),
  missingKeys: z.array(localeResourceKeySchema),
});

export const localeCoverageResponseSchema = z.object({
  data: z.array(localeCoverageEntrySchema),
});

export const localeOverviewResponseSchema = z.object({
  data: z.object({
    localeCount: z.number().int().nonnegative(),
    resourceCount: z.number().int().nonnegative(),
    canonicalKeyCount: z.number().int().nonnegative(),
    pendingReviewCount: z.number().int().nonnegative(),
    qaIssueCount: z.number().int().nonnegative(),
    lastQaRunAt: z.iso.datetime().nullable(),
    defaultLocale: localeCodeSchema,
    fallbackLocale: localeCodeSchema.nullable(),
  }),
});

export const localeReviewQueueItemSchema = z.object({
  locale: localeCodeSchema,
  key: localeResourceKeySchema,
  value: localeResourceValueSchema,
  reviewStatus: localeReviewStatusSchema,
  sourceValue: z.string().nullable(),
  updatedAt: z.iso.datetime(),
});

export const localeReviewQueueResponseSchema = z.object({
  data: z.array(localeReviewQueueItemSchema),
});

export const updateLocaleReviewBodySchema = z
  .object({
    status: z.enum(["approved", "rejected"]),
    tenant_id: z.never().optional(),
    tenantId: z.never().optional(),
  })
  .strict();

export const localeReviewUpdateResponseSchema = z.object({
  data: localeReviewQueueItemSchema,
});

export const localeQaIssueSeveritySchema = z.enum(["error", "warning", "info"]);

export const localeQaIssueTypeSchema = z.enum([
  "missing_key",
  "empty_translation",
  "placeholder_mismatch",
  "length_warning",
]);

export const localeQaIssueDtoSchema = z.object({
  id: z.uuid(),
  locale: localeCodeSchema,
  key: localeResourceKeySchema,
  severity: localeQaIssueSeveritySchema,
  issueType: localeQaIssueTypeSchema,
  message: z.string(),
  createdAt: z.iso.datetime(),
});

export const localeQaCheckRunDtoSchema = z.object({
  id: z.uuid(),
  issueCount: z.number().int().nonnegative(),
  startedAt: z.iso.datetime(),
  completedAt: z.iso.datetime(),
});

export const localeQaChecksResponseSchema = z.object({
  data: z.object({
    run: localeQaCheckRunDtoSchema.nullable(),
    issues: z.array(localeQaIssueDtoSchema),
  }),
});

export const runLocaleQaChecksResponseSchema = z.object({
  data: z.object({
    run: localeQaCheckRunDtoSchema,
    issues: z.array(localeQaIssueDtoSchema),
  }),
});

export const localeImportItemSchema = z
  .object({
    key: localeResourceKeySchema,
    value: localeResourceValueSchema,
  })
  .strict();

export const localeImportPreviewBodySchema = z
  .object({
    locale: localeCodeSchema,
    resources: z.array(localeImportItemSchema).min(1).max(500),
    tenant_id: z.never().optional(),
    tenantId: z.never().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const keys = value.resources.map((resource) => resource.key);
    const unique = new Set(keys);
    if (unique.size !== keys.length) {
      ctx.addIssue({
        code: "custom",
        message: "Duplicate locale keys in import body.",
        path: ["resources"],
      });
    }
  });

export const localeImportPreviewEntrySchema = z.object({
  key: localeResourceKeySchema,
  action: z.enum(["add", "update", "unchanged"]),
  currentValue: z.string().nullable(),
  nextValue: z.string(),
});

export const localeImportPreviewResponseSchema = z.object({
  data: z.object({
    locale: localeCodeSchema,
    summary: z.object({
      add: z.number().int().nonnegative(),
      update: z.number().int().nonnegative(),
      unchanged: z.number().int().nonnegative(),
    }),
    entries: z.array(localeImportPreviewEntrySchema),
  }),
});

export const localeImportBodySchema = localeImportPreviewBodySchema;

export const localeImportResponseSchema = z.object({
  data: z.object({
    locale: localeCodeSchema,
    applied: z.number().int().nonnegative(),
    resources: z.array(localeResourceDtoSchema),
  }),
});

export const localeExportFormatSchema = z.enum(["json"]);

export const localeExportQuerySchema = z.object({
  locale: localeCodeSchema,
  format: localeExportFormatSchema.default("json"),
});

export const localeExportResponseSchema = z.object({
  data: z.object({
    locale: localeCodeSchema,
    format: localeExportFormatSchema,
    resources: z.array(localeImportItemSchema),
    exportedAt: z.iso.datetime(),
  }),
});

export type UpsertLocaleResourcesBody = z.infer<typeof upsertLocaleResourcesBodySchema>;
export type UpsertLocaleMetadataBody = z.infer<typeof upsertLocaleMetadataBodySchema>;
export type UpdateLocaleReviewBody = z.infer<typeof updateLocaleReviewBodySchema>;
export type LocaleImportPreviewBody = z.infer<typeof localeImportPreviewBodySchema>;
export type LocaleImportBody = z.infer<typeof localeImportBodySchema>;
