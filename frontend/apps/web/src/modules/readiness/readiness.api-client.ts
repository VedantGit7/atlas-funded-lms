import { clientApi } from "../../lib/client-api";
import type { z } from "zod";
import type {
  attributionTokenResponseSchema,
  readinessPolicyResponseSchema,
  updateReadinessPolicyBodySchema,
} from "@atlas/contracts/readiness/readiness.schemas";

type ReadinessPolicyResponse = z.infer<typeof readinessPolicyResponseSchema>;
type UpdateReadinessPolicyBody = z.infer<typeof updateReadinessPolicyBodySchema>;
type AttributionTokenResponse = z.infer<typeof attributionTokenResponseSchema>;

export const readinessApiClient = {
  async getReadinessPolicy(): Promise<ReadinessPolicyResponse> {
    return clientApi.get<ReadinessPolicyResponse>("/api/v1/readiness-policy");
  },

  async updateReadinessPolicy(body: UpdateReadinessPolicyBody): Promise<ReadinessPolicyResponse> {
    return clientApi.put<ReadinessPolicyResponse>(
      "/api/v1/readiness-policy",
      body,
      "readiness-policy",
    );
  },

  async createAttributionToken(body: {
    sourceSurface: string;
    sourcePath: string;
  }): Promise<AttributionTokenResponse> {
    return clientApi.post<AttributionTokenResponse>(
      "/api/v1/cta/attribution-token",
      body,
      "attribution-token",
    );
  },
};
