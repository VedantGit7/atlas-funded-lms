"use client";

import { useQuery } from "@tanstack/react-query";

import { clientApi } from "../client";
import { queryKeys } from "../query-keys";
import { queryStaleTimes } from "../query-stale-times";

export type MeQueryData = {
  data: {
    membership: { id: string; status: string };
    profile: { displayName: string | null; avatarUrl: string | null } | null;
  };
};

export function useMeQuery() {
  return useQuery({
    queryKey: queryKeys.me(),
    queryFn: () => clientApi.get<MeQueryData>("/api/v1/me"),
    staleTime: queryStaleTimes.meShell,
  });
}
