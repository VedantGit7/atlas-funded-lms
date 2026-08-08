"use client";

import { useQuery } from "@tanstack/react-query";

import { clientApi } from "../client";
import { queryKeys } from "../query-keys";
import { queryStaleTimes } from "../query-stale-times";

export type NotificationsQueryData = {
  data: Array<{ id: string; readAt: string | null }>;
};

type UseNotificationsQueryOptions = Readonly<{
  limit?: number;
}>;

export function useNotificationsQuery({ limit = 25 }: UseNotificationsQueryOptions = {}) {
  return useQuery({
    queryKey: queryKeys.notifications({ limit }),
    queryFn: () => clientApi.get<NotificationsQueryData>(`/api/v1/me/notifications?limit=${limit}`),
    staleTime: queryStaleTimes.notifications,
  });
}
