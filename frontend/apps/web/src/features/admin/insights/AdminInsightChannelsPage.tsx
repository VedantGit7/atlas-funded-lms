"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchInsightMessengerChannels,
  type InsightMessengerChannelsBoard,
} from "./admin-insights-api";
import { MessengerInsightChannelsView } from "./MessengerInsightChannelsView";

type AdminInsightChannelsPageProps = {
  slug: string;
  sectionTitle: string;
};

export function AdminInsightChannelsPage({ slug, sectionTitle }: AdminInsightChannelsPageProps) {
  const [board, setBoard] = useState<InsightMessengerChannelsBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBoard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchInsightMessengerChannels(slug);
      setBoard(response.data);
    } catch (loadError) {
      setBoard(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "There was a problem retrieving messenger channels. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  return (
    <MessengerInsightChannelsView
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
