"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchInsightMarketingWorkflows,
  type InsightMarketingWorkflowsBoard,
} from "./admin-insights-api";
import { MarketingInsightWorkflowsView } from "./MarketingInsightWorkflowsView";

type AdminInsightWorkflowsPageProps = {
  slug: string;
  sectionTitle: string;
};

export function AdminInsightWorkflowsPage({ slug, sectionTitle }: AdminInsightWorkflowsPageProps) {
  const [board, setBoard] = useState<InsightMarketingWorkflowsBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBoard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchInsightMarketingWorkflows(slug);
      setBoard(response.data);
    } catch (loadError) {
      setBoard(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "There was a problem retrieving workflow data. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  return (
    <MarketingInsightWorkflowsView
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
