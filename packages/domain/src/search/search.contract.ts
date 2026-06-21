import type { z } from "zod";
import type {
  searchListResponseSchema,
  searchQuerySchema,
  searchReindexResponseSchema,
  searchResultItemSchema,
} from "./search.dto";

export type SearchQuery = z.output<typeof searchQuerySchema>;
export type SearchResultItem = z.output<typeof searchResultItemSchema>;
export type SearchListResponse = z.output<typeof searchListResponseSchema>;
export type SearchReindexResponse = z.output<typeof searchReindexResponseSchema>;
