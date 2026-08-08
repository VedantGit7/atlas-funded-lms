import { clientApi } from "../../lib/client-api";
import type { SearchResultItem } from "@atlas/domain/search/search.contract";

export type SearchListResponse = {
  data: {
    items: SearchResultItem[];
    pageInfo: {
      nextCursor: string | null;
      hasNextPage: boolean;
    };
  };
};

export async function fetchSearchResults(params: {
  q?: string;
  type?: string;
  cursor?: string;
  limit?: number;
}): Promise<SearchListResponse> {
  const searchParams = new URLSearchParams();

  if (params.q) searchParams.set("q", params.q);
  if (params.type) searchParams.set("type", params.type);
  if (params.cursor) searchParams.set("cursor", params.cursor);
  if (params.limit) searchParams.set("limit", String(params.limit));

  const query = searchParams.toString();
  const path = query.length > 0 ? `/api/v1/search?${query}` : "/api/v1/search";

  return clientApi.get<SearchListResponse>(path);
}

export async function requestSearchReindex(idempotencyKey: string): Promise<{
  data: { queued: true; eventType: "search.reindex_requested" };
}> {
  return clientApi.post("/api/v1/search/reindex", {}, idempotencyKey);
}
