"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchInsightLiveAttendance,
  type InsightLiveAttendanceBoard,
  type InsightLiveAttendanceQuery,
} from "./admin-insights-api";
import { LiveDashboardAttendanceView } from "./LiveDashboardAttendanceView";

type AdminInsightLiveAttendancePageProps = {
  slug: string;
  sectionTitle: string;
};

const DEFAULT_QUERY: Required<InsightLiveAttendanceQuery> = {
  page: 1,
  pageSize: 8,
};

export function AdminInsightLiveAttendancePage({
  slug,
  sectionTitle,
}: AdminInsightLiveAttendancePageProps) {
  const [board, setBoard] = useState<InsightLiveAttendanceBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState<Required<InsightLiveAttendanceQuery>>(DEFAULT_QUERY);

  const loadBoard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchInsightLiveAttendance(slug, query);
      setBoard(response.data);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "There was a problem retrieving the attendance overview. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [slug, query]);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  return (
    <LiveDashboardAttendanceView
      slug={slug}
      sectionTitle={sectionTitle}
      board={board}
      loading={loading}
      error={error}
      query={query}
      onQueryChange={(patch) => {
        setQuery((prev) => ({ ...prev, ...patch }));
      }}
      onRefresh={() => {
        void loadBoard();
      }}
    />
  );
}
