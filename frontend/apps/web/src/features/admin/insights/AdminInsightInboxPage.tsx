"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchInsightMessengerInbox, type InsightMessengerInboxBoard } from "./admin-insights-api";
import { MessengerInsightInboxView } from "./MessengerInsightInboxView";

type AdminInsightInboxPageProps = {
  slug: string;
  sectionTitle: string;
};

export function AdminInsightInboxPage({ slug, sectionTitle }: AdminInsightInboxPageProps) {
  const [board, setBoard] = useState<InsightMessengerInboxBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBoard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchInsightMessengerInbox(slug);
      setBoard(response.data);
    } catch (loadError) {
      setBoard(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "There was a problem retrieving inbox insight. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  return (
    <MessengerInsightInboxView
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
