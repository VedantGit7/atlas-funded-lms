// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

import type { z } from "zod";
import type {
  certificateAnalyticsResponseSchema,
  certificateBulkIssueBodySchema,
  certificateBulkIssueResponseSchema,
  certificateDetailResponseSchema,
  certificateIssueBodySchema,
  certificateListQuerySchema,
  certificateListResponseSchema,
  certificateLifecycleActionBodySchema,
  certificateRevokeBodySchema,
  certificateTemplateDetailResponseSchema,
  certificateTemplateListResponseSchema,
  createCertificateTemplateBodySchema,
  deleteCertificateTemplateBodySchema,
  publishCertificateTemplateBodySchema,
  publicVerifyResponseSchema,
  updateCertificateTemplateBodySchema,
  certificateBrandKitListResponseSchema,
  certificateBrandKitDetailResponseSchema,
  createCertificateBrandKitBodySchema,
  updateCertificateBrandKitBodySchema,
  deleteCertificateBrandKitBodySchema,
  deleteCertificateBrandKitResponseSchema,
} from "./certificate.dto";

export type CertificateListQuery = z.output<typeof certificateListQuerySchema>;
export type CertificateListResponse = z.output<typeof certificateListResponseSchema>;
export type CertificateDetailResponse = z.output<typeof certificateDetailResponseSchema>;
export type CertificateIssueBody = z.output<typeof certificateIssueBodySchema>;
export type CertificateBulkIssueBody = z.output<typeof certificateBulkIssueBodySchema>;
export type CertificateBulkIssueResponse = z.output<typeof certificateBulkIssueResponseSchema>;
export type CertificateAnalyticsResponse = z.output<typeof certificateAnalyticsResponseSchema>;
export type CertificateLifecycleActionBody = z.output<typeof certificateLifecycleActionBodySchema>;
export type CertificateRevokeBody = z.output<typeof certificateRevokeBodySchema>;
export type CertificateTemplateListResponse = z.output<
  typeof certificateTemplateListResponseSchema
>;
export type CertificateTemplateDetailResponse = z.output<
  typeof certificateTemplateDetailResponseSchema
>;
export type CreateCertificateTemplateBody = z.output<typeof createCertificateTemplateBodySchema>;
export type UpdateCertificateTemplateBody = z.output<typeof updateCertificateTemplateBodySchema>;
export type DeleteCertificateTemplateBody = z.output<typeof deleteCertificateTemplateBodySchema>;
export type PublishCertificateTemplateBody = z.output<typeof publishCertificateTemplateBodySchema>;
export type PublicVerifyResponse = z.output<typeof publicVerifyResponseSchema>;
export type CertificateBrandKitListResponse = z.output<
  typeof certificateBrandKitListResponseSchema
>;
export type CertificateBrandKitDetailResponse = z.output<
  typeof certificateBrandKitDetailResponseSchema
>;
export type CreateCertificateBrandKitBody = z.output<typeof createCertificateBrandKitBodySchema>;
export type UpdateCertificateBrandKitBody = z.output<typeof updateCertificateBrandKitBodySchema>;
export type DeleteCertificateBrandKitBody = z.output<typeof deleteCertificateBrandKitBodySchema>;
export type DeleteCertificateBrandKitResponse = z.output<
  typeof deleteCertificateBrandKitResponseSchema
>;
