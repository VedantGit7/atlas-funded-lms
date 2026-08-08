import { serverApi } from "../../lib/server-api";
import type { z } from "zod";
import type { PublicLandingResponseSchema } from "@atlas/contracts/domain-branding/schemas/public-landing";

type PublicLandingResponse = z.infer<typeof PublicLandingResponseSchema>;

export const publicLandingServerApi = {
  async getLanding(slug: string): Promise<PublicLandingResponse> {
    return serverApi.get<PublicLandingResponse>(
      `/api/v1/public/landing/${encodeURIComponent(slug)}`,
    );
  },
};
