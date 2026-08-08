import type { z } from "zod";
import type {
  certificateBulkIssueBodySchema,
  certificateBulkIssueResponseSchema,
  certificateDetailResponseSchema,
  certificateIssueBodySchema,
  certificateListQuerySchema,
  certificateListResponseSchema,
  certificateRevokeBodySchema,
  certificateTemplateDetailResponseSchema,
  certificateTemplateListResponseSchema,
  createCertificateTemplateBodySchema,
  deleteCertificateTemplateBodySchema,
  publishCertificateTemplateBodySchema,
  publicVerifyResponseSchema,
  updateCertificateTemplateBodySchema,
} from "./certificate.dto";

export type CertificateListQuery = z.output<typeof certificateListQuerySchema>;
export type CertificateListResponse = z.output<typeof certificateListResponseSchema>;
export type CertificateDetailResponse = z.output<typeof certificateDetailResponseSchema>;
export type CertificateIssueBody = z.output<typeof certificateIssueBodySchema>;
export type CertificateBulkIssueBody = z.output<typeof certificateBulkIssueBodySchema>;
export type CertificateBulkIssueResponse = z.output<typeof certificateBulkIssueResponseSchema>;
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
