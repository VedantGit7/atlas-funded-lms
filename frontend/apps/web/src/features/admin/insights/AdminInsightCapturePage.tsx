"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchInsightMarketingCapture,
  type InsightMarketingCaptureBoard,
} from "./admin-insights-api";
import { MarketingInsightCaptureView } from "./MarketingInsightCaptureView";

type AdminInsightCapturePageProps = {
  slug: string;
  sectionTitle: string;
};

export function AdminInsightCapturePage({ slug, sectionTitle }: AdminInsightCapturePageProps) {
  const [board, setBoard] = useState<InsightMarketingCaptureBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBoard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchInsightMarketingCapture(slug);
      setBoard(response.data);
    } catch (loadError) {
      setBoard(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "There was a problem retrieving capture data. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  return (
    <MarketingInsightCaptureView
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
