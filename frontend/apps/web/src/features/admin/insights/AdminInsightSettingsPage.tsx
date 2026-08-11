"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchInsightSettings,
  mutateInsightSettings,
  type InsightSettingsBoard,
  type InsightSettingsMutation,
} from "./admin-insights-api";
import { setInsightNumberFormat } from "./admin-insights-format";
import { InsightSettingsView } from "./InsightSettingsView";

type AdminInsightSettingsPageProps = {
  slug: string;
  sectionTitle: string;
};

export function AdminInsightSettingsPage({ slug, sectionTitle }: AdminInsightSettingsPageProps) {
  const [board, setBoard] = useState<InsightSettingsBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mutating, setMutating] = useState(false);

  const loadBoard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchInsightSettings(slug);
      setBoard(response.data);
      setInsightNumberFormat(response.data.settings.numberFormat);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "There was a problem loading insight settings. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  const onMutate = useCallback(
    async (body: InsightSettingsMutation) => {
      setMutating(true);
      setError(null);
      try {
        const response = await mutateInsightSettings(slug, body);
        setBoard(response.data);
        setInsightNumberFormat(response.data.settings.numberFormat);
        return response.data;
      } catch (mutateError) {
        setError(
          mutateError instanceof Error
            ? mutateError.message
            : "The settings update did not complete. Please try again.",
        );
        return null;
      } finally {
        setMutating(false);
      }
    },
    [slug],
  );

  return (
    <InsightSettingsView
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
