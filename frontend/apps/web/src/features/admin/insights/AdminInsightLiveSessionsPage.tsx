"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchInsightLiveSessions,
  type InsightLiveSessionsBoard,
  type InsightLiveSessionsQuery,
} from "./admin-insights-api";
import { LiveDashboardSessionsView } from "./LiveDashboardSessionsView";

type AdminInsightLiveSessionsPageProps = {
  slug: string;
  sectionTitle: string;
};

const DEFAULT_QUERY: Required<InsightLiveSessionsQuery> = {
  view: "all",
  q: "",
  status: "all",
  turnout: "all",
  watch: "all",
  sort: "scheduled_desc",
  page: 1,
  pageSize: 12,
};

export function AdminInsightLiveSessionsPage({
  slug,
  sectionTitle,
}: AdminInsightLiveSessionsPageProps) {
  const [board, setBoard] = useState<InsightLiveSessionsBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState<Required<InsightLiveSessionsQuery>>(DEFAULT_QUERY);

  const loadBoard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchInsightLiveSessions(slug, query);
      setBoard(response.data);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "There was a problem retrieving the sessions ledger. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [slug, query]);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  return (
    <LiveDashboardSessionsView
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
