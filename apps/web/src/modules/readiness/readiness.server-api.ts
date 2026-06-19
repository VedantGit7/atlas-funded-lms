import { serverApi } from "../../lib/server-api";
import type { z } from "zod";
import type { readinessPolicyResponseSchema } from "../../server/readiness/readiness.schemas";

type ReadinessPolicyResponse = z.infer<typeof readinessPolicyResponseSchema>;

export const readinessServerApi = {
  async getReadinessPolicy(): Promise<ReadinessPolicyResponse> {
    return serverApi.get<ReadinessPolicyResponse>("/api/v1/readiness-policy");
  },
};
