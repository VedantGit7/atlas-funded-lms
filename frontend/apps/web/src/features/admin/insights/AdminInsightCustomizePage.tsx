"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchInsightLayout,
  mutateInsightLayout,
  type InsightLayoutBoard,
  type InsightLayoutMutation,
} from "./admin-insights-api";
import { InsightCustomizeView } from "./InsightCustomizeView";

type AdminInsightCustomizePageProps = {
  slug: string;
  sectionTitle: string;
};

export function AdminInsightCustomizePage({ slug, sectionTitle }: AdminInsightCustomizePageProps) {
  const [board, setBoard] = useState<InsightLayoutBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mutating, setMutating] = useState(false);

  const loadBoard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchInsightLayout(slug);
      setBoard(response.data);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "There was a problem loading this layout. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  const onMutate = useCallback(
    async (body: InsightLayoutMutation) => {
      setMutating(true);
      setError(null);
      try {
        const response = await mutateInsightLayout(slug, body);
        setBoard(response.data);
        return response.data;
      } catch (mutateError) {
        setError(
          mutateError instanceof Error
            ? mutateError.message
            : "The layout update did not complete. Please try again.",
        );
        return null;
      } finally {
        setMutating(false);
      }
    },
    [slug],
  );

  return (
    <InsightCustomizeView
      slug={slug}
      sectionTitle={sectionTitle}
      board={board}
      loading={loading}
      mutating={mutating}
      error={error}
      onRetry={() => {
        void loadBoard();
      }}
      onMutate={onMutate}
    />
  );
}
