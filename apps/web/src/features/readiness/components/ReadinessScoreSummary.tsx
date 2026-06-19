import type { z } from "zod";
import type { myCompetencyResponseSchema } from "../../../server/competency/competency-projection.schemas";

type CompetencyScore = z.infer<typeof myCompetencyResponseSchema>["data"]["scores"][number];

type ReadinessScoreSummaryProps = {
  scores: CompetencyScore[];
};

export function ReadinessScoreSummary({ scores }: ReadinessScoreSummaryProps) {
  if (scores.length === 0) {
    return (
      <section className="rounded border p-4" aria-label="Competency scores">
        <h2 className="text-lg font-semibold">Competency scores</h2>
        <p className="text-sm opacity-80">No competency scores recorded yet.</p>
      </section>
    );
  }

  return (
    <section className="rounded border p-4" aria-label="Competency scores">
      <h2 className="mb-4 text-lg font-semibold">Competency scores</h2>
      <ul className="grid gap-3 md:grid-cols-2">
        {scores.map((score) => (
          <li key={`${score.scoringProfileId}:${score.dimensionId}`} className="rounded border p-3">
            <p className="font-medium">{score.dimensionName}</p>
            <p className="text-sm opacity-80">{score.dimensionKey}</p>
            <p className="mt-2 text-xl font-semibold">{score.score.toFixed(1)}</p>
            <p className="text-sm">Band: {score.bandLabel ?? score.bandKey ?? "Unassigned"}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
