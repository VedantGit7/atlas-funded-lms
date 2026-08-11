"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchInsightLibrary,
  mutateInsightLibrary,
  type InsightDashboardRange,
  type InsightLibraryBoard,
  type InsightLibraryMutation,
} from "./admin-insights-api";
import { InsightLibraryView } from "./InsightLibraryView";

type AdminInsightLibraryPageProps = {
  slug: string;
  sectionTitle: string;
  initialRange: InsightDashboardRange;
  initialTarget?: string | undefined;
};

export function AdminInsightLibraryPage({
  slug,
  sectionTitle,
  initialRange,
  initialTarget,
}: AdminInsightLibraryPageProps) {
  const [board, setBoard] = useState<InsightLibraryBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<InsightDashboardRange>(initialRange);
  const [target, setTarget] = useState(initialTarget || slug);
  const [mutating, setMutating] = useState(false);

  const loadBoard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchInsightLibrary(slug, range, target);
      setBoard(response.data);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "There was a problem loading the widget library. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [range, slug, target]);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  const onMutate = useCallback(
    async (body: InsightLibraryMutation) => {
      setMutating(true);
      setError(null);
      try {
        const response = await mutateInsightLibrary(slug, { ...body, targetSlug: target, range });
        setBoard(response.data);
        return response.data;
      } catch (mutateError) {
        setError(
          mutateError instanceof Error
            ? mutateError.message
            : "The library update did not complete. Please try again.",
        );
        return null;
      } finally {
        setMutating(false);
      }
    },
    [range, slug, target],
  );

  return (
    <InsightLibraryView
      slug={slug}
      sectionTitle={sectionTitle}
      board={board}
      loading={loading}
      mutating={mutating}
      error={error}
      range={range}
      target={target}
      onRangeChange={setRange}
      onTargetChange={(next) => {
        setTarget(next);
      }}
      onRetry={() => {
        void loadBoard();
      }}
      onMutate={onMutate}
    />
  );
}
