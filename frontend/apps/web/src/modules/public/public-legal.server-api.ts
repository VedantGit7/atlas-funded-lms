import { serverApi } from "../../lib/server-api";
import type { z } from "zod";
import type {
  LegalDocumentSlug,
  PublicLegalDocumentResponseSchema,
} from "@atlas/contracts/domain-branding/schemas/public-legal";

type PublicLegalDocumentResponse = z.infer<typeof PublicLegalDocumentResponseSchema>;

export const publicLegalServerApi = {
  async getDocument(slug: LegalDocumentSlug): Promise<PublicLegalDocumentResponse> {
    return serverApi.get<PublicLegalDocumentResponse>(
      `/api/v1/public/legal/${encodeURIComponent(slug)}`,
    );
  },
};
