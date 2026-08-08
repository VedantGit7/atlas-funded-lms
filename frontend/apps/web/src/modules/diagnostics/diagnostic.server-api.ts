import { serverApi } from "../../lib/server-api";
import type { z } from "zod";
import type {
  authenticatedDiagnosticResultResponseSchema,
  authenticatedDiagnosticStartResponseSchema,
  diagnosticCatalogResponseSchema,
} from "./diagnostic.schemas";

type AuthenticatedDiagnosticStartResponse = z.infer<
  typeof authenticatedDiagnosticStartResponseSchema
>;
type AuthenticatedDiagnosticResultResponse = z.infer<
  typeof authenticatedDiagnosticResultResponseSchema
>;
type DiagnosticCatalogResponse = z.infer<typeof diagnosticCatalogResponseSchema>;

export const diagnosticServerApi = {
  async getDiagnosticCatalog(): Promise<DiagnosticCatalogResponse> {
    return serverApi.get<DiagnosticCatalogResponse>("/api/v1/me/diagnostics");
  },

  async startAuthenticatedDiagnostic(): Promise<AuthenticatedDiagnosticStartResponse> {
    return serverApi.post<AuthenticatedDiagnosticStartResponse>(
      "/api/v1/diagnostic/start",
      {},
      "authenticated-diagnostic-start",
    );
  },

  async getAuthenticatedDiagnosticResult(
    sessionId: string,
  ): Promise<AuthenticatedDiagnosticResultResponse> {
    return serverApi.get<AuthenticatedDiagnosticResultResponse>(
      `/api/v1/diagnostic/${sessionId}/result`,
    );
  },
};
