import { z } from "zod";
import { isHttpUrlOrRootPath, toPlainText } from "../core/text/safe-text";
import { certificateDesignDocumentSchema } from "./certificate-design-document";

const rejectClientTenantFields = z
  .object({
    tenant_id: z.never().optional(),
    tenantId: z.never().optional(),
  })
  .loose();

export function sanitizeCertificateText(value: string): string {
  return toPlainText(value);
}

export const certificateTemplateFieldSchema = z
  .object({
    headline: z.string().min(1).max(160),
    subheadline: z.string().max(240).optional(),
    bodyLines: z.array(z.string().min(1).max(500)).max(12).default([]),
    accentColor: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/)
      .optional(),
  })
  .strict();

export const certificateTemplateJsonSchema = certificateTemplateFieldSchema.transform((value) => ({
  headline: sanitizeCertificateText(value.headline),
  subheadline: value.subheadline ? sanitizeCertificateText(value.subheadline) : undefined,
  bodyLines: value.bodyLines.map((line) => sanitizeCertificateText(line)),
  accentColor: value.accentColor,
}));

export const certificateTemplateJsonUnionSchema = z.union([
  certificateDesignDocumentSchema,
  certificateTemplateFieldSchema,
]);

export const certificateTemplateJsonInputSchema = z.union([
  certificateDesignDocumentSchema,
  certificateTemplateJsonSchema,
]);

export const certificateIssueSourceSchema = z
  .object({
    type: z.enum(["course", "learning_path", "assessment"]),
    id: z.uuid(),
  })
  .strict();

export const certificateStatusSchema = z.enum(["issued", "revoked", "expired", "suspended"]);

export const certificateTemplateDtoSchema = z.object({
  id: z.uuid(),
  key: z.string(),
  name: z.string(),
  templateJson: certificateTemplateJsonUnionSchema,
  status: z.enum(["DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED"]),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const certificateDtoSchema = z.object({
  id: z.uuid(),
  templateId: z.uuid(),
  templateName: z.string(),
  membershipId: z.uuid(),
  credentialId: z.string(),
  status: certificateStatusSchema,
  issuedAt: z.iso.datetime(),
  revokedAt: z.iso.datetime().nullable(),
  verificationUrl: z.string(),
  recipientLabel: z.string().nullable().optional(),
  expiresAt: z.iso.datetime().optional(),
  serialNumber: z.string().optional(),
  downloadUrl: z.string().optional(),
  courseTitle: z.string().optional(),
  recipientName: z.string().optional(),
  designSnapshotHash: z.string().optional(),
  suspendedAt: z.iso.datetime().nullable().optional(),
});

export const certificateListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(25),
    cursor: z.uuid().optional(),
    status: certificateStatusSchema.optional(),
    membershipId: z.uuid().optional(),
  })
  .strict();

export const certificateListResponseSchema = z.object({
  data: z.array(certificateDtoSchema),
  page: z.object({
    nextCursor: z.uuid().nullable(),
    hasMore: z.boolean(),
  }),
});

export const certificateDetailResponseSchema = z.object({
  data: certificateDtoSchema,
});

export const certificateTemplateListResponseSchema = z.object({
  data: z.array(certificateTemplateDtoSchema),
});

export const certificateTemplateDetailResponseSchema = z.object({
  data: certificateTemplateDtoSchema,
});

export const createCertificateTemplateBodySchema = z
  .object({
    key: z
      .string()
      .min(2)
      .max(64)
      .regex(/^[a-z0-9][a-z0-9_-]*$/),
    name: z.string().min(1).max(160),
    templateJson: certificateTemplateJsonInputSchema,
  })
  .strict()
  .and(rejectClientTenantFields);

export const updateCertificateTemplateBodySchema = z
  .object({
    id: z.uuid(),
    key: z
      .string()
      .min(2)
      .max(64)
      .regex(/^[a-z0-9][a-z0-9_-]*$/)
      .optional(),
    name: z.string().min(1).max(160).optional(),
    templateJson: certificateTemplateJsonInputSchema.optional(),
  })
  .strict()
  .and(rejectClientTenantFields);

export const deleteCertificateTemplateBodySchema = z
  .object({
    id: z.uuid(),
  })
  .strict()
  .and(rejectClientTenantFields);

export const publishCertificateTemplateBodySchema = z
  .object({
    reason: z.string().max(500).optional(),
  })
  .strict()
  .and(rejectClientTenantFields);

export const certificateIssueBodySchema = z
  .object({
    templateId: z.uuid(),
    recipientMembershipId: z.uuid(),
    source: certificateIssueSourceSchema,
    expiresAt: z.iso.datetime().optional(),
    validityDays: z.number().int().positive().max(36_500).optional(),
  })
  .strict()
  .and(rejectClientTenantFields);

export const certificateBulkIssueRecipientSchema = z
  .object({
    recipientMembershipId: z.uuid(),
    source: certificateIssueSourceSchema,
  })
  .strict();

export const certificateBulkIssueBodySchema = z
  .object({
    templateId: z.uuid(),
    recipients: z.array(certificateBulkIssueRecipientSchema).min(1).max(100),
    expiresAt: z.iso.datetime().optional(),
    validityDays: z.number().int().positive().max(36_500).optional(),
  })
  .strict()
  .and(rejectClientTenantFields);

export const certificateBulkIssueFailureSchema = z.object({
  recipientMembershipId: z.uuid(),
  error: z.string(),
});

export const certificateBulkIssueResponseSchema = z.object({
  data: z.object({
    issued: z.array(certificateDtoSchema),
    failed: z.array(certificateBulkIssueFailureSchema),
  }),
});

export const certificateRevokeBodySchema = z
  .object({
    reason: z.string().min(1).max(500),
    confirm: z.literal(true),
  })
  .strict()
  .and(rejectClientTenantFields);

export const certificateLifecycleActionBodySchema = z
  .object({
    reason: z.string().min(1).max(500).optional(),
  })
  .strict()
  .and(rejectClientTenantFields);

export const certificateAnalyticsResponseSchema = z.object({
  data: z.object({
    issued: z.number().int().nonnegative(),
    revoked: z.number().int().nonnegative(),
    expired: z.number().int().nonnegative(),
    suspended: z.number().int().nonnegative(),
  }),
});

export const deleteCertificateTemplateResponseSchema = z.object({
  data: z.object({
    id: z.uuid(),
    deleted: z.literal(true),
  }),
});

export const publicVerifyResponseSchema = z.object({
  data: z.object({
    credentialId: z.string(),
    certificateId: z.uuid().optional(),
    status: certificateStatusSchema,
    issuedAt: z.iso.datetime(),
    verifiedAt: z.iso.datetime(),
    recipientName: z.string().optional(),
    courseTitle: z.string().optional(),
    expiresAt: z.iso.datetime().optional(),
    serialNumber: z.string().optional(),
    downloadUrl: z.string().optional(),
    issuer: z.object({
      displayName: z.string().nullable(),
      logoUrl: z.string().nullable(),
    }),
  }),
});

export const certificateIssuedOutboxPayloadSchema = z.object({
  certificateId: z.uuid(),
  credentialId: z.string(),
  templateId: z.uuid(),
  membershipId: z.uuid(),
  issuedAt: z.iso.datetime(),
  workflowTransitionId: z.uuid().nullable(),
});

export const certificateRevokedOutboxPayloadSchema = z.object({
  certificateId: z.uuid(),
  credentialId: z.string(),
  revokedAt: z.iso.datetime(),
});

export const certificateRenderPreviewBodySchema = z
  .object({
    templateJson: certificateDesignDocumentSchema,
    data: z.record(z.string(), z.string()).optional(),
    watermark: z.boolean().optional(),
    showBleedSafe: z.boolean().optional(),
  })
  .strict()
  .and(rejectClientTenantFields);

export const certificateRenderPreviewResponseSchema = z.object({
  html: z.string().min(1),
});

export const certificateWalletPassResponseSchema = z.object({
  data: z.object({
    platform: z.enum(["apple", "google"]),
    status: z.enum(["not_configured", "active"]),
    saveUrl: z.string().optional(),
    downloadUrl: z.string().optional(),
    passObjectKey: z.string().optional(),
    message: z.string(),
  }),
});

// A logo / asset URL may be an absolute URL or a same-origin relative path
// (e.g. `/brand/avatar-gradient.svg`), so we validate shape rather than `.url()`.
const brandAssetUrlSchema = z
  .string()
  .min(1)
  .max(2048)
  .refine(isHttpUrlOrRootPath, "Must be an http(s) URL or a path on this site.");

export const certificateBrandKitColorSchema = z
  .object({
    name: z.string().min(1).max(60),
    hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  })
  .strict();

export const certificateBrandKitFontSchema = z
  .object({
    label: z.string().min(1).max(80),
    family: z.string().min(1).max(200),
  })
  .strict();

export const certificateBrandKitAssetSchema = z
  .object({
    name: z.string().min(1).max(80),
    url: brandAssetUrlSchema,
  })
  .strict();

export const certificateBrandKitDtoSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  logoUrl: z.string().nullable(),
  colors: z.array(certificateBrandKitColorSchema),
  fonts: z.array(certificateBrandKitFontSchema),
  assets: z.array(certificateBrandKitAssetSchema),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const certificateBrandKitListResponseSchema = z.object({
  data: z.array(certificateBrandKitDtoSchema),
});

export const certificateBrandKitDetailResponseSchema = z.object({
  data: certificateBrandKitDtoSchema,
});

export const createCertificateBrandKitBodySchema = z
  .object({
    name: z.string().min(1).max(160),
    logoUrl: brandAssetUrlSchema.nullish(),
    colors: z.array(certificateBrandKitColorSchema).max(24).optional(),
    fonts: z.array(certificateBrandKitFontSchema).max(24).optional(),
    assets: z.array(certificateBrandKitAssetSchema).max(48).optional(),
  })
  .strict()
  .and(rejectClientTenantFields);

export const updateCertificateBrandKitBodySchema = z
  .object({
    id: z.uuid(),
    name: z.string().min(1).max(160).optional(),
    logoUrl: brandAssetUrlSchema.nullish(),
    colors: z.array(certificateBrandKitColorSchema).max(24).optional(),
    fonts: z.array(certificateBrandKitFontSchema).max(24).optional(),
    assets: z.array(certificateBrandKitAssetSchema).max(48).optional(),
  })
  .strict()
  .and(rejectClientTenantFields);

export const deleteCertificateBrandKitBodySchema = z
  .object({
    id: z.uuid(),
  })
  .strict()
  .and(rejectClientTenantFields);

export const deleteCertificateBrandKitResponseSchema = z.object({
  data: z.object({
    id: z.uuid(),
    deleted: z.literal(true),
  }),
});
