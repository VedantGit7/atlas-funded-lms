import { serverApi } from "../../lib/server-api";
import type { z } from "zod";
import type { dueQueueResponseSchema } from "../../server/practice/practice.schemas";

type DueQueueResponse = z.infer<typeof dueQueueResponseSchema>;

export const practiceServerApi = {
  async getDueQueue(query?: {
    cursor?: string;
    limit?: number;
    collectionId?: string;
  }): Promise<DueQueueResponse> {
    const params = new URLSearchParams();
    if (query?.cursor) params.set("cursor", query.cursor);
    if (query?.limit != null) params.set("limit", String(query.limit));
    if (query?.collectionId) params.set("collectionId", query.collectionId);
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return serverApi.get<DueQueueResponse>(`/api/v1/me/srs/due${suffix}`);
  },
};
