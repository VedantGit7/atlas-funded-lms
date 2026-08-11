"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchInsightSalesPipeline, type InsightSalesPipelineBoard } from "./admin-insights-api";
import { SalesInsightPipelineView } from "./SalesInsightPipelineView";

type AdminInsightPipelinePageProps = {
  slug: string;
  sectionTitle: string;
};

export function AdminInsightPipelinePage({ slug, sectionTitle }: AdminInsightPipelinePageProps) {
  const [board, setBoard] = useState<InsightSalesPipelineBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBoard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchInsightSalesPipeline(slug);
      setBoard(response.data);
    } catch (loadError) {
      setBoard(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "There was a problem retrieving the sales pipeline. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  return (
    <SalesInsightPipelineView
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
