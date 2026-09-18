"use client";

import { useEffect, useState } from "react";
import { competencyApiClient } from "@atlas/contracts-modules/competency/competency.api-client";
import { CompetencyScoreCards } from "./CompetencyScoreCards";

type MemberCompetencyPanelProps = {
  membershipId: string;
};

export function MemberCompetencyPanel({ membershipId }: MemberCompetencyPanelProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scores, setScores] = useState<
    Awaited<ReturnType<typeof competencyApiClient.getMemberCompetency>>["data"]["scores"]
  >([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const response = await competencyApiClient.getMemberCompetency(membershipId);
        if (!cancelled) {
          setScores(response.data.scores);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load competency.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [membershipId]);

  if (loading) {
    return (
      <section className="rounded border p-4">
        <p className="text-sm opacity-80">Loading learner competency…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded border p-4">
        <p className="text-sm text-destructive-text" role="alert">
          {error}
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-2">
      <h3 className="font-medium">Competency</h3>
      <CompetencyScoreCards scores={scores} />
    </section>
  );
}
