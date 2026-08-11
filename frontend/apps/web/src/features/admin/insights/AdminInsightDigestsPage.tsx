"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchInsightDigests,
  mutateInsightDigests,
  type InsightDigestsBoard,
  type InsightDigestsMutation,
} from "./admin-insights-api";
import { InsightDigestsView } from "./InsightDigestsView";

type AdminInsightDigestsPageProps = {
  slug: string;
  sectionTitle: string;
};

export function AdminInsightDigestsPage({ slug, sectionTitle }: AdminInsightDigestsPageProps) {
  const [board, setBoard] = useState<InsightDigestsBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mutating, setMutating] = useState(false);

  const loadBoard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchInsightDigests(slug);
      setBoard(response.data);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "There was a problem loading digests. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  const onMutate = useCallback(
    async (body: InsightDigestsMutation) => {
      setMutating(true);
      setError(null);
      try {
        const response = await mutateInsightDigests(slug, body);
        setBoard(response.data);
        return response.data;
      } catch (mutateError) {
        setError(
          mutateError instanceof Error
            ? mutateError.message
            : "The digest update did not complete. Please try again.",
        );
        return null;
      } finally {
        setMutating(false);
      }
    },
    [slug],
  );

  const onPreview = useCallback(
    async (id: string | null) => {
      if (!id) {
        setBoard((current) => (current ? { ...current, preview: null } : current));
        return;
      }
      setError(null);
      try {
        const response = await fetchInsightDigests(slug, id);
        setBoard(response.data);
      } catch (previewError) {
        setError(
          previewError instanceof Error
            ? previewError.message
            : "The email preview did not load. Please try again.",
        );
      }
    },
    [slug],
  );

  return (
    <InsightDigestsView
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
      onPreview={onPreview}
    />
  );
}
