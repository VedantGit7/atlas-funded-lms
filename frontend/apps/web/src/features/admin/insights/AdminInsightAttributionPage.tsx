"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchInsightSalesAttribution,
  type InsightSalesAttributionBoard,
} from "./admin-insights-api";
import { SalesInsightAttributionView } from "./SalesInsightAttributionView";

type AdminInsightAttributionPageProps = {
  slug: string;
  sectionTitle: string;
};

export function AdminInsightAttributionPage({
  slug,
  sectionTitle,
}: AdminInsightAttributionPageProps) {
  const [board, setBoard] = useState<InsightSalesAttributionBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBoard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchInsightSalesAttribution(slug);
      setBoard(response.data);
    } catch (loadError) {
      setBoard(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "There was a problem retrieving attribution. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  return (
    <SalesInsightAttributionView
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
