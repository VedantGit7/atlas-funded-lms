"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchInsightWidgetDetail,
  type InsightDashboardRange,
  type InsightWidgetDetail,
} from "./admin-insights-api";
import { InsightWidgetDetailView } from "./InsightWidgetDetailView";
import { LiveDashboardWidgetDetailView } from "./LiveDashboardWidgetDetailView";
import { MarketingInsightWidgetDetailView } from "./MarketingInsightWidgetDetailView";
import { MessengerInsightWidgetDetailView } from "./MessengerInsightWidgetDetailView";
import { SalesInsightWidgetDetailView } from "./SalesInsightWidgetDetailView";
import { SchoolVitalsWidgetDetailView } from "./SchoolVitalsWidgetDetailView";

type AdminInsightWidgetDetailPageProps = {
  slug: string;
  widgetId: string;
  sectionTitle: string;
  initialRange: InsightDashboardRange;
  overlay: boolean;
};

export function AdminInsightWidgetDetailPage({
  slug,
  widgetId,
  sectionTitle,
  initialRange,
  overlay,
}: AdminInsightWidgetDetailPageProps) {
  const [detail, setDetail] = useState<InsightWidgetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<InsightDashboardRange>(initialRange);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchInsightWidgetDetail(slug, widgetId, range);
      setDetail(response.data);
    } catch (loadError) {
      setDetail(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "There was a problem retrieving this widget. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [range, slug, widgetId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const viewProps = {
    slug,
    sectionTitle,
    detail,
    loading,
    error,
    range,
    overlay,
    onRangeChange: setRange,
    onRefresh: () => {
      void loadDetail();
    },
  };

  if (slug === "school-vitals") {
    return <SchoolVitalsWidgetDetailView {...viewProps} />;
  }

  if (slug === "sales-insight") {
    return <SalesInsightWidgetDetailView {...viewProps} />;
  }

  if (slug === "live-dashboard") {
    return <LiveDashboardWidgetDetailView {...viewProps} />;
  }

  if (slug === "marketing-insight") {
    return <MarketingInsightWidgetDetailView {...viewProps} />;
  }

  if (slug === "messenger-insight") {
    return <MessengerInsightWidgetDetailView {...viewProps} />;
  }

  return <InsightWidgetDetailView {...viewProps} />;
}
