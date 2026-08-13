"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchInsightMarketingAttribution,
  fetchInsightSalesAttribution,
  type InsightMarketingAttributionBoard,
  type InsightSalesAttributionBoard,
} from "./admin-insights-api";
import { MarketingInsightAttributionView } from "./MarketingInsightAttributionView";
import { SalesInsightAttributionView } from "./SalesInsightAttributionView";

type AdminInsightAttributionPageProps = {
  slug: string;
  sectionTitle: string;
};

export function AdminInsightAttributionPage({
  slug,
  sectionTitle,
}: AdminInsightAttributionPageProps) {
  if (slug === "marketing-insight") {
    return <MarketingAttributionLoader slug={slug} sectionTitle={sectionTitle} />;
  }

  return <SalesAttributionLoader slug={slug} sectionTitle={sectionTitle} />;
}

function SalesAttributionLoader({ slug, sectionTitle }: AdminInsightAttributionPageProps) {
  const [board, setBoard] = useState<InsightSalesAttributionBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBoard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchInsightSalesAttribution(slug);
      if (response.data.slug !== "sales-insight") {
        throw new Error("Unexpected attribution payload for Sales Insight.");
      }
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

function MarketingAttributionLoader({ slug, sectionTitle }: AdminInsightAttributionPageProps) {
  const [board, setBoard] = useState<InsightMarketingAttributionBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBoard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchInsightMarketingAttribution(slug);
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
    <MarketingInsightAttributionView
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
