import { z } from "zod";
import { certificateDesignDocumentSchema } from "./certificate-design-document";

const rejectClientTenantFields = z
  .object({
    tenant_id: z.never().optional(),
    tenantId: z.never().optional(),
  })
  .passthrough();

const htmlTagPattern = /<[^>]*>/g;
const scriptPattern = /javascript:/i;

export function sanitizeCertificateText(value: string): string {
  const stripped = value.replace(htmlTagPattern, "").replace(scriptPattern, "").trim();
  return stripped;
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
    id: z.string().uuid(),
  })
  .strict();

export const certificateStatusSchema = z.enum(["issued", "revoked", "expired", "suspended"]);

export const certificateTemplateDtoSchema = z.object({
  id: z.string().uuid(),
  key: z.string(),
  name: z.string(),
  templateJson: certificateTemplateJsonUnionSchema,
  status: z.enum(["DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED"]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const certificateDtoSchema = z.object({
  id: z.string().uuid(),
  templateId: z.string().uuid(),
  templateName: z.string(),
  membershipId: z.string().uuid(),
  credentialId: z.string(),
  status: certificateStatusSchema,
  issuedAt: z.string().datetime(),
  revokedAt: z.string().datetime().nullable(),
  verificationUrl: z.string(),
  recipientLabel: z.string().nullable().optional(),
  expiresAt: z.string().datetime().optional(),
  serialNumber: z.string().optional(),
  downloadUrl: z.string().optional(),
  courseTitle: z.string().optional(),
  recipientName: z.string().optional(),
  designSnapshotHash: z.string().optional(),
  suspendedAt: z.string().datetime().nullable().optional(),
});

export const certificateListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(25),
    cursor: z.string().uuid().optional(),
    status: certificateStatusSchema.optional(),
    membershipId: z.string().uuid().optional(),
  })
  .strict();

export const certificateListResponseSchema = z.object({
  data: z.array(certificateDtoSchema),
  page: z.object({
    nextCursor: z.string().uuid().nullable(),
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
    id: z.string().uuid(),
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
    id: z.string().uuid(),
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
    templateId: z.string().uuid(),
    recipientMembershipId: z.string().uuid(),
    source: certificateIssueSourceSchema,
    expiresAt: z.string().datetime().optional(),
    validityDays: z.number().int().positive().max(36_500).optional(),
  })
  .strict()
  .and(rejectClientTenantFields);

export const certificateBulkIssueRecipientSchema = z
  .object({
    recipientMembershipId: z.string().uuid(),
    source: certificateIssueSourceSchema,
  })
  .strict();

export const certificateBulkIssueBodySchema = z
  .object({
    templateId: z.string().uuid(),
    recipients: z.array(certificateBulkIssueRecipientSchema).min(1).max(100),
    expiresAt: z.string().datetime().optional(),
    validityDays: z.number().int().positive().max(36_500).optional(),
  })
  .strict()
  .and(rejectClientTenantFields);

export const certificateBulkIssueFailureSchema = z.object({
  recipientMembershipId: z.string().uuid(),
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
    id: z.string().uuid(),
    deleted: z.literal(true),
  }),
});

export const publicVerifyResponseSchema = z.object({
  data: z.object({
    credentialId: z.string(),
    status: certificateStatusSchema,
    issuedAt: z.string().datetime(),
    verifiedAt: z.string().datetime(),
    recipientName: z.string().optional(),
    courseTitle: z.string().optional(),
    expiresAt: z.string().datetime().optional(),
    serialNumber: z.string().optional(),
    downloadUrl: z.string().optional(),
    issuer: z.object({
      displayName: z.string().nullable(),
      logoUrl: z.string().nullable(),
    }),
  }),
});

export const certificateIssuedOutboxPayloadSchema = z.object({
  certificateId: z.string().uuid(),
  credentialId: z.string(),
  templateId: z.string().uuid(),
  membershipId: z.string().uuid(),
  issuedAt: z.string().datetime(),
  workflowTransitionId: z.string().uuid().nullable(),
});

export const certificateRevokedOutboxPayloadSchema = z.object({
  certificateId: z.string().uuid(),
  credentialId: z.string(),
  revokedAt: z.string().datetime(),
});
