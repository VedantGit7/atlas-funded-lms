"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchInsightEngagementFunnel,
  type InsightDashboardRange,
  type InsightEngagementFunnelBoard,
} from "./admin-insights-api";
import { SchoolVitalsFunnelView } from "./SchoolVitalsFunnelView";

type AdminInsightFunnelPageProps = {
  slug: string;
  sectionTitle: string;
  initialRange: InsightDashboardRange;
};

export function AdminInsightFunnelPage({
  slug,
  sectionTitle,
  initialRange,
}: AdminInsightFunnelPageProps) {
  const [board, setBoard] = useState<InsightEngagementFunnelBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<InsightDashboardRange>(initialRange);

  const loadBoard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchInsightEngagementFunnel(slug, range);
      setBoard(response.data);
    } catch (loadError) {
      setBoard(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "There was a problem retrieving the engagement funnel. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [range, slug]);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  return (
    <SchoolVitalsFunnelView
      slug={slug}
      sectionTitle={sectionTitle}
      board={board}
      loading={loading}
      error={error}
      range={range}
      onRangeChange={setRange}
      onRefresh={() => {
        void loadBoard();
      }}
    />
  );
}
