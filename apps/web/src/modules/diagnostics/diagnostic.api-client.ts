import { clientApi } from "../../lib/client-api";
import type { z } from "zod";
import type {
  authenticatedDiagnosticResultResponseSchema,
  authenticatedDiagnosticStartResponseSchema,
  PublicDiagnosticStartBodySchema,
  publicDiagnosticMergeResponseSchema,
  publicDiagnosticResultResponseSchema,
  publicDiagnosticStartUnionResponseSchema,
} from "./diagnostic.schemas";

type PublicDiagnosticStartBody = z.infer<typeof PublicDiagnosticStartBodySchema>;
type PublicDiagnosticStartResponse = z.infer<typeof publicDiagnosticStartUnionResponseSchema>;
type PublicDiagnosticResultResponse = z.infer<typeof publicDiagnosticResultResponseSchema>;
type PublicDiagnosticMergeResponse = z.infer<typeof publicDiagnosticMergeResponseSchema>;
type AuthenticatedDiagnosticStartResponse = z.infer<
  typeof authenticatedDiagnosticStartResponseSchema
>;
type AuthenticatedDiagnosticResultResponse = z.infer<
  typeof authenticatedDiagnosticResultResponseSchema
>;

export const diagnosticApiClient = {
  async startPublicDiagnostic(
    body: PublicDiagnosticStartBody,
  ): Promise<PublicDiagnosticStartResponse> {
    return clientApi.post<PublicDiagnosticStartResponse>(
      "/api/v1/public/diagnostic/start",
      body,
      `public-diagnostic-${body.operation}`,
    );
  },

  async getPublicDiagnosticResult(anonymousId: string): Promise<PublicDiagnosticResultResponse> {
    return clientApi.get<PublicDiagnosticResultResponse>(
      `/api/v1/public/diagnostic/${anonymousId}/result`,
    );
  },

  async mergePublicDiagnostic(anonymousId: string): Promise<PublicDiagnosticMergeResponse> {
    return clientApi.post<PublicDiagnosticMergeResponse>(
      `/api/v1/public/diagnostic/${anonymousId}/merge`,
      {},
      `diagnostic-merge-${anonymousId}`,
    );
  },

  async startAuthenticatedDiagnostic(): Promise<AuthenticatedDiagnosticStartResponse> {
    return clientApi.post<AuthenticatedDiagnosticStartResponse>(
      "/api/v1/diagnostic/start",
      {},
      "authenticated-diagnostic-start",
    );
  },

  async getAuthenticatedDiagnosticResult(
    sessionId: string,
  ): Promise<AuthenticatedDiagnosticResultResponse> {
    return clientApi.get<AuthenticatedDiagnosticResultResponse>(
      `/api/v1/diagnostic/${sessionId}/result`,
    );
  },
};
