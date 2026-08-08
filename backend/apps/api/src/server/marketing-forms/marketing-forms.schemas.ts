import { z } from "zod";

export const formStatusSchema = z.enum(["DRAFT", "LIVE", "UNPUBLISHED"]);
export const formKindSchema = z.enum(["LEAD", "SIGNUP"]);
export const formFieldTypeSchema = z.enum([
  "email",
  "password",
  "text",
  "textarea",
  "phone",
  "number",
]);

export const formFieldSchema = z
  .object({
    id: z.string().min(1).max(64),
    key: z.string().trim().min(1).max(64),
    label: z.string().trim().min(1).max(200),
    placeholder: z.string().trim().max(200).nullable().optional(),
    fieldType: formFieldTypeSchema,
    required: z.boolean(),
    isSystem: z.boolean().optional().default(false),
    sortOrder: z.number().int().min(0).max(500),
  })
  .strict();

export const marketingFormDtoSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  status: formStatusSchema,
  kind: formKindSchema,
  shareToken: z.string(),
  sharePath: z.string(),
  googleSignupEnabled: z.boolean(),
  buttonText: z.string(),
  buttonColor: z.string(),
  buttonTextColor: z.string(),
  thankYouHtml: z.string().nullable(),
  redirectEnabled: z.boolean(),
  redirectUrl: z.string().nullable(),
  fields: z.array(formFieldSchema),
  submissionCount: z.number().int().nonnegative(),
  publishedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const marketingFormsListQuerySchema = z
  .object({
    status: z.enum(["ALL", "DRAFT", "LIVE", "UNPUBLISHED"]).optional().default("ALL"),
    q: z.string().trim().max(200).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export const marketingFormsListResponseSchema = z.object({
  data: z.object({
    items: z.array(marketingFormDtoSchema),
    summary: z.object({
      liveCount: z.number().int().nonnegative(),
      draftCount: z.number().int().nonnegative(),
      unpublishedCount: z.number().int().nonnegative(),
      totalCount: z.number().int().nonnegative(),
    }),
  }),
});

export const marketingFormResponseSchema = z.object({ data: marketingFormDtoSchema });

export const createMarketingFormBodySchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000).optional().nullable(),
    kind: formKindSchema.optional().default("LEAD"),
  })
  .strict();

export const updateMarketingFormBasicsBodySchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000).optional().nullable(),
    googleSignupEnabled: z.boolean().optional(),
  })
  .strict();

export const updateMarketingFormFieldsBodySchema = z
  .object({ fields: z.array(formFieldSchema).max(50) })
  .strict();

export const updateMarketingFormAppearanceBodySchema = z
  .object({
    buttonText: z.string().trim().min(1).max(80),
    buttonColor: z.string().trim().min(3).max(32),
    buttonTextColor: z.string().trim().min(3).max(32),
    thankYouHtml: z.string().trim().max(20000).optional().nullable(),
    redirectEnabled: z.boolean(),
    redirectUrl: z.string().trim().url().max(2000).optional().nullable(),
  })
  .strict();

export const deleteMarketingFormBodySchema = z
  .object({ titleConfirmation: z.string().trim().min(1).max(200) })
  .strict();

export const deleteMarketingFormResponseSchema = z.object({
  data: z.object({ id: z.string().uuid(), deleted: z.literal(true) }),
});

export const marketingFormSubmissionDtoSchema = z.object({
  id: z.string().uuid(),
  formId: z.string().uuid(),
  contactId: z.string().uuid(),
  email: z.string(),
  displayName: z.string().nullable(),
  answers: z.record(z.string(), z.unknown()),
  source: z.string(),
  createdAt: z.string().datetime(),
});

export const marketingFormSubmissionsResponseSchema = z.object({
  data: z.object({ items: z.array(marketingFormSubmissionDtoSchema) }),
});

export const marketingContactDtoSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  displayName: z.string().nullable(),
  phone: z.string().nullable(),
  sourceFormId: z.string().uuid().nullable(),
  source: z.string(),
  submissionCount: z.number().int().nonnegative(),
  associatedForms: z.array(
    z.object({
      id: z.string().uuid(),
      title: z.string(),
    }),
  ),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const marketingContactsListQuerySchema = z
  .object({
    q: z.string().trim().max(200).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export const marketingContactsListResponseSchema = z.object({
  data: z.object({
    items: z.array(marketingContactDtoSchema),
    summary: z.object({
      totalCount: z.number().int().nonnegative(),
    }),
  }),
});

export const publicMarketingFormDtoSchema = z.object({
  title: z.string(),
  description: z.string().nullable(),
  kind: formKindSchema,
  googleSignupEnabled: z.boolean(),
  buttonText: z.string(),
  buttonColor: z.string(),
  buttonTextColor: z.string(),
  fields: z.array(
    formFieldSchema.omit({ isSystem: true }).extend({ isSystem: z.boolean().optional() }),
  ),
});

export const publicMarketingFormResponseSchema = z.object({
  data: publicMarketingFormDtoSchema,
});

export const publicSubmitFormBodySchema = z
  .object({
    answers: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
    source: z.enum(["LINK", "WEBSITE", "CTA"]).optional().default("LINK"),
  })
  .strict();

export const publicSubmitFormResponseSchema = z.object({
  data: z.object({
    submitted: z.literal(true),
    thankYouHtml: z.string().nullable(),
    redirectUrl: z.string().nullable(),
  }),
});
