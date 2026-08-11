"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchInsightContentHealth,
  type InsightContentHealthBoard,
  type InsightDashboardRange,
} from "./admin-insights-api";
import { SchoolVitalsContentHealthView } from "./SchoolVitalsContentHealthView";

type AdminInsightContentHealthPageProps = {
  slug: string;
  sectionTitle: string;
  initialRange: InsightDashboardRange;
};

export function AdminInsightContentHealthPage({
  slug,
  sectionTitle,
  initialRange,
}: AdminInsightContentHealthPageProps) {
  const [board, setBoard] = useState<InsightContentHealthBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<InsightDashboardRange>(initialRange);

  const loadBoard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchInsightContentHealth(slug, range);
      setBoard(response.data);
    } catch (loadError) {
      setBoard(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "There was a problem retrieving content health. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [range, slug]);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  return (
    <SchoolVitalsContentHealthView
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
