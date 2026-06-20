import { serverApi } from "../../lib/server-api";
import type { z } from "zod";
import type {
  authenticatedDiagnosticResultResponseSchema,
  authenticatedDiagnosticStartResponseSchema,
} from "./diagnostic.schemas";

type AuthenticatedDiagnosticStartResponse = z.infer<
  typeof authenticatedDiagnosticStartResponseSchema
>;
type AuthenticatedDiagnosticResultResponse = z.infer<
  typeof authenticatedDiagnosticResultResponseSchema
>;

export const diagnosticServerApi = {
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
