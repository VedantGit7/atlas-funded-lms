"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchInsightMessengerWhatsapp,
  type InsightMessengerWhatsappBoard,
} from "./admin-insights-api";
import { MessengerInsightWhatsappView } from "./MessengerInsightWhatsappView";

type AdminInsightWhatsappPageProps = {
  slug: string;
  sectionTitle: string;
};

export function AdminInsightWhatsappPage({ slug, sectionTitle }: AdminInsightWhatsappPageProps) {
  const [board, setBoard] = useState<InsightMessengerWhatsappBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBoard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchInsightMessengerWhatsapp(slug);
      setBoard(response.data);
    } catch (loadError) {
      setBoard(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "There was a problem retrieving WhatsApp insight. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  return (
    <MessengerInsightWhatsappView
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
