"use client";

import { useQuery } from "@tanstack/react-query";

import { clientApi } from "../client";
import { queryKeys } from "../query-keys";
import { queryStaleTimes } from "../query-stale-times";

export type CoursesListQueryData = {
  data: Array<{ id: string; title: string }>;
};

export function useCoursesQuery() {
  return useQuery({
    queryKey: queryKeys.courses.all(),
    queryFn: () => clientApi.get<CoursesListQueryData>("/api/v1/courses"),
    staleTime: queryStaleTimes.catalogList,
  });
}
