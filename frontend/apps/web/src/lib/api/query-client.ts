import { QueryClient, type DefaultOptions } from "@tanstack/react-query";

import { queryStaleTimes } from "./query-stale-times";

/** Default cache timings aligned with performance.md §3.2 */
export const defaultQueryOptions: DefaultOptions = {
  queries: {
    staleTime: queryStaleTimes.default,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: true,
    retry: 1,
  },
  mutations: {
    retry: 0,
  },
};

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: defaultQueryOptions,
  });
}
