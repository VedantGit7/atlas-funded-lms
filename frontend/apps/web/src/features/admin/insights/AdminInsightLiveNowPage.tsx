"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchInsightLiveNow, type InsightLiveNowBoard } from "./admin-insights-api";
import { LiveDashboardNowView } from "./LiveDashboardNowView";

type AdminInsightLiveNowPageProps = {
  slug: string;
  sectionTitle: string;
};

export function AdminInsightLiveNowPage({ slug, sectionTitle }: AdminInsightLiveNowPageProps) {
  const [board, setBoard] = useState<InsightLiveNowBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBoard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchInsightLiveNow(slug);
      setBoard(response.data);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "There was a problem retrieving the Now board. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  return (
    <LiveDashboardNowView
      slug={slug}
      sectionTitle={sectionTitle}
      board={board}
      loading={loading}
      error={error}
      onRefresh={() => {
        void loadBoard();
      }}
    />
  );
}
