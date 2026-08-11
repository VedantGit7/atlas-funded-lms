"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchInsightDashboard,
  fetchInsightSettings,
  mutateInsightLayout,
  type InsightDashboard,
  type InsightDashboardRange,
  type InsightLayout,
} from "./admin-insights-api";
import { adminInsightCustomizeHref, adminInsightHref } from "./admin-insights-catalog";
import { setInsightNumberFormat } from "./admin-insights-format";
import { clearLayoutDraft, readLayoutDraft } from "./admin-insights-layout";
import { InsightDashboardView } from "./InsightDashboardView";

type AdminInsightDashboardPageProps = {
  slug: string;
  title: string;
  preview?: boolean;
};

type DashboardPrefs = {
  autoRefresh: boolean;
  refreshIntervalMinutes: number;
  cacheMinutes: number;
  showLastUpdated: boolean;
  restrictedSlugs: string[];
};

export function AdminInsightDashboardPage({
  slug,
  title,
  preview = false,
}: AdminInsightDashboardPageProps) {
  const router = useRouter();
  const [dashboard, setDashboard] = useState<InsightDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<InsightDashboardRange>(
    slug === "school-vitals" ? "30d" : "12m",
  );
  const [rangeReady, setRangeReady] = useState(false);
  const [prefs, setPrefs] = useState<DashboardPrefs | null>(null);
  const [previewLayout, setPreviewLayout] = useState<InsightLayout | null>(null);
  const [savingPreview, setSavingPreview] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchInsightSettings(slug)
      .then((response) => {
        if (cancelled) return;
        const row = response.data.settings;
        setInsightNumberFormat(row.numberFormat);
        setRange(row.defaultPeriod);
        setPrefs({
          autoRefresh: row.autoRefresh,
          refreshIntervalMinutes: row.refreshIntervalMinutes,
          cacheMinutes: row.cacheMinutes,
          showLastUpdated: row.showLastUpdated,
          restrictedSlugs: row.restrictedSlugs,
        });
      })
      .catch(() => {
        if (!cancelled)
          setPrefs({
            autoRefresh: false,
            refreshIntervalMinutes: 15,
            cacheMinutes: 30,
            showLastUpdated: true,
            restrictedSlugs: [],
          });
      })
      .finally(() => {
        if (!cancelled) setRangeReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const loadDashboard = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const response = await fetchInsightDashboard(slug, range);
        setDashboard(response.data);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "There was a problem retrieving visualization data. Please try again.",
        );
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [range, slug],
  );

  useEffect(() => {
    if (!rangeReady) return;
    void loadDashboard();
  }, [loadDashboard, rangeReady]);

  useEffect(() => {
    if (!prefs?.autoRefresh || preview) return;
    const ms = Math.max(prefs.refreshIntervalMinutes, prefs.cacheMinutes) * 60 * 1000;
    const timer = window.setInterval(() => {
      void loadDashboard(true);
    }, ms);
    return () => {
      window.clearInterval(timer);
    };
  }, [loadDashboard, prefs, preview]);

  useEffect(() => {
    if (!preview) {
      setPreviewLayout(null);
      return;
    }
    setPreviewLayout(readLayoutDraft(slug));
  }, [preview, slug]);

  return (
    <InsightDashboardView
      slug={slug}
      title={title}
      dashboard={dashboard}
      loading={loading || !rangeReady}
      error={error}
      range={range}
      onRangeChange={setRange}
      onRefresh={() => {
        void loadDashboard();
      }}
      showLastUpdated={prefs?.showLastUpdated !== false}
      hiddenSlugs={prefs?.restrictedSlugs ?? []}
      preview={preview && Boolean(previewLayout)}
      previewLayout={previewLayout}
      savingPreview={savingPreview}
      onSavePreview={() => {
        if (!previewLayout) return;
        setSavingPreview(true);
        void mutateInsightLayout(slug, { action: "save", layout: previewLayout })
          .then(() => {
            clearLayoutDraft(slug);
            router.replace(adminInsightHref(slug));
          })
          .catch((saveError: unknown) => {
            setError(
              saveError instanceof Error
                ? saveError.message
                : "The layout could not be saved. Please try again.",
            );
          })
          .finally(() => {
            setSavingPreview(false);
          });
      }}
      onDiscardPreview={() => {
        router.push(adminInsightCustomizeHref(slug));
      }}
    />
  );
}
