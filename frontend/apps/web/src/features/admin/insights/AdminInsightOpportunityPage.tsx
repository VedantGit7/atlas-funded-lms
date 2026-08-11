"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchInsightSalesOpportunity,
  type InsightSalesOpportunityBoard,
} from "./admin-insights-api";
import { SalesInsightOpportunityView } from "./SalesInsightOpportunityView";

type AdminInsightOpportunityPageProps = {
  slug: string;
  sectionTitle: string;
};

export function AdminInsightOpportunityPage({
  slug,
  sectionTitle,
}: AdminInsightOpportunityPageProps) {
  const [board, setBoard] = useState<InsightSalesOpportunityBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBoard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchInsightSalesOpportunity(slug);
      setBoard(response.data);
    } catch (loadError) {
      setBoard(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "There was a problem retrieving conversion opportunity. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  return (
    <SalesInsightOpportunityView
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
