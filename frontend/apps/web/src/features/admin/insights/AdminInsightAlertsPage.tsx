"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchInsightAlerts,
  mutateInsightAlerts,
  type InsightAlertsBoard,
  type InsightAlertsMutation,
  type InsightDashboardRange,
} from "./admin-insights-api";
import { InsightAlertsView, type InsightAlertsTab } from "./InsightAlertsView";
import { SalesInsightAlertsView } from "./SalesInsightAlertsView";

type AdminInsightAlertsPageProps = {
  slug: string;
  sectionTitle: string;
  initialRange: InsightDashboardRange;
  initialTab: InsightAlertsTab;
};

function replaceTabInUrl(tab: InsightAlertsTab): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (tab === "open") url.searchParams.delete("tab");
  else url.searchParams.set("tab", tab);
  window.history.replaceState(null, "", `${url.pathname}${url.search}`);
}

export function AdminInsightAlertsPage({
  slug,
  sectionTitle,
  initialRange,
  initialTab,
}: AdminInsightAlertsPageProps) {
  const sales = slug === "sales-insight";
  const [board, setBoard] = useState<InsightAlertsBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<InsightDashboardRange>(initialRange);
  const [tab, setTab] = useState<InsightAlertsTab>(initialTab);
  const [mutating, setMutating] = useState(false);

  const onTabChange = useCallback((next: InsightAlertsTab) => {
    setTab(next);
    replaceTabInUrl(next);
  }, []);

  const loadBoard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchInsightAlerts(slug, range);
      setBoard(response.data);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "There was a problem retrieving alerts. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [range, slug]);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  const onMutate = useCallback(
    async (body: InsightAlertsMutation) => {
      setMutating(true);
      try {
        const response = await mutateInsightAlerts(slug, { ...body, range });
        setBoard(response.data);
      } catch (mutateError) {
        setError(
          mutateError instanceof Error
            ? mutateError.message
            : "The alert update did not complete. Please try again.",
        );
      } finally {
        setMutating(false);
      }
    },
    [range, slug],
  );

  if (sales) {
    return (
      <SalesInsightAlertsView
        slug={slug}
        sectionTitle={sectionTitle}
        board={board}
        loading={loading}
        mutating={mutating}
        error={error}
        tab={tab}
        onTabChange={onTabChange}
        onRefresh={() => {
          void loadBoard();
        }}
        onMutate={onMutate}
      />
    );
  }

  return (
    <InsightAlertsView
      slug={slug}
      sectionTitle={sectionTitle}
      board={board}
      loading={loading}
      mutating={mutating}
      error={error}
      range={range}
      tab={tab}
      onRangeChange={setRange}
      onTabChange={onTabChange}
      onRefresh={() => {
        void loadBoard();
      }}
      onMutate={onMutate}
    />
  );
}
