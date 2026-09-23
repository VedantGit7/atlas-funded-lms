import { z } from "zod";

/** Evidence of offboarding only. This contract deliberately cannot claim erasure. */
export const accessRemovalOutcomeSchema = z
  .object({
    version: z.literal(1),
    operation: z.literal("remove_school_access"),
    accessRemoved: z.literal(true),
    erasure: z.literal("not_performed"),
    globalIdentity: z.literal("unchanged"),
    retentionReviewRequired: z.literal(true),
    legalHoldAssessment: z.literal("not_performed"),
    retained: z
      .array(
        z
          .object({
            category: z.enum([
              "membership",
              "profile",
              "learning",
              "payments",
              "uploads_proctoring",
              "analytics_search",
              "providers",
              "backups",
            ]),
            reason: z.enum([
              "access_status_only",
              "outside_access_removal_scope",
              "external_system_review_required",
              "backup_expiry_unverified",
            ]),
          })
          .strict(),
      )
      .min(8)
      .max(8),
  })
  .strict();

export type AccessRemovalOutcome = z.infer<typeof accessRemovalOutcomeSchema>;

export function buildAccessRemovalOutcome(): AccessRemovalOutcome {
  return accessRemovalOutcomeSchema.parse({
    version: 1,
    operation: "remove_school_access",
    accessRemoved: true,
    erasure: "not_performed",
    globalIdentity: "unchanged",
    retentionReviewRequired: true,
    legalHoldAssessment: "not_performed",
    retained: [
      { category: "membership", reason: "access_status_only" },
      { category: "profile", reason: "outside_access_removal_scope" },
      { category: "learning", reason: "outside_access_removal_scope" },
      { category: "payments", reason: "outside_access_removal_scope" },
      { category: "uploads_proctoring", reason: "outside_access_removal_scope" },
      { category: "analytics_search", reason: "outside_access_removal_scope" },
      { category: "providers", reason: "external_system_review_required" },
      { category: "backups", reason: "backup_expiry_unverified" },
    ],
  });
}

/** Actual fields read by buildTenantExportSnapshot; not a subject access export. */
export const TENANT_EXPORT_COVERAGE = {
  version: 1,
  kind: "tenant_snapshot",
  completePersonalDataExport: false,
  includedFields: {
    memberships: ["id", "status", "joinedAt"],
    memberProfiles: ["membershipId", "displayName"],
    courses: ["id", "slug", "title", "status"],
    enrollments: ["id", "courseId", "membershipId", "status"],
  },
  excludedCategories: [
    "global_identity_and_authentication",
    "other_profile_fields_and_preferences",
    "assessments_and_submissions",
    "lesson_progress_and_certificates",
    "payments_and_billing",
    "uploads_and_proctoring_media",
    "community_and_messages",
    "analytics_and_search",
    "audit_and_security_records",
    "external_provider_data",
    "backups",
  ],
} as const;
