import type { z } from "zod";
import { serverApi } from "../../lib/server-api";
import type {
  certificateDetailResponseSchema,
  certificateListResponseSchema,
  certificateTemplateDetailResponseSchema,
  certificateTemplateListResponseSchema,
  publicVerifyResponseSchema,
} from "@atlas/contracts/certificates/certificate.dto";

type CertificateListResponse = z.infer<typeof certificateListResponseSchema>;
type CertificateDetailResponse = z.infer<typeof certificateDetailResponseSchema>;
type CertificateTemplateListResponse = z.infer<typeof certificateTemplateListResponseSchema>;
type CertificateTemplateDetailResponse = z.infer<typeof certificateTemplateDetailResponseSchema>;
type PublicVerifyResponse = z.infer<typeof publicVerifyResponseSchema>;

export const certificateApi = {
  listCertificates(query = "limit=25"): Promise<CertificateListResponse> {
    return serverApi.get<CertificateListResponse>(`/api/v1/certificates?${query}`);
  },

  listTemplates(): Promise<CertificateTemplateListResponse> {
    return serverApi.get<CertificateTemplateListResponse>("/api/v1/certificate-templates");
  },

  createTemplate(body: object): Promise<CertificateTemplateDetailResponse> {
    return serverApi.post<CertificateTemplateDetailResponse>(
      "/api/v1/certificate-templates",
      body,
      "cert-template-create",
    );
  },

  updateTemplate(body: object): Promise<CertificateTemplateDetailResponse> {
    return serverApi.post<CertificateTemplateDetailResponse>(
      "/api/v1/certificate-templates",
      body,
      "cert-template-update",
    );
  },

  issueCertificate(body: object): Promise<CertificateDetailResponse> {
    return serverApi.post<CertificateDetailResponse>(
      "/api/v1/certificates/issue",
      body,
      "cert-issue",
    );
  },

  revokeCertificate(id: string, body: object): Promise<CertificateDetailResponse> {
    return serverApi.post<CertificateDetailResponse>(
      `/api/v1/certificates/${id}/revoke`,
      body,
      "cert-revoke",
    );
  },

  publishTemplate(id: string, body: object = {}): Promise<CertificateTemplateDetailResponse> {
    return serverApi.post<CertificateTemplateDetailResponse>(
      `/api/v1/certificate-templates/${id}/publish`,
      body,
      "cert-template-publish",
    );
  },

  verifyPublic(credentialId: string): Promise<PublicVerifyResponse> {
    return serverApi.get<PublicVerifyResponse>(`/api/v1/public/verify/${credentialId}`);
  },
};
