import type { z } from "zod";
import type { myCompetencyResponseSchema } from "../../../server/competency/competency-projection.schemas";

type CompetencyScore = z.infer<typeof myCompetencyResponseSchema>["data"]["scores"][number];

type ReadinessChecklistProps = {
  scores: CompetencyScore[];
};

export function ReadinessChecklist({ scores }: ReadinessChecklistProps) {
  const gaps = scores.filter((score) => score.bandKey == null || score.score < 60);

  return (
    <section className="rounded border p-4" aria-label="Readiness checklist">
      <h2 className="text-lg font-semibold">Readiness checklist</h2>
      <p className="mb-3 text-sm opacity-80">
        Focus areas based on your current competency signals. Education remains available regardless
        of readiness band.
      </p>
      {gaps.length === 0 ? (
        <p className="text-sm">No major gaps detected in tracked dimensions.</p>
      ) : (
        <ul className="space-y-2">
          {gaps.map((score) => (
            <li key={score.dimensionId} className="rounded border px-3 py-2 text-sm">
              <span className="font-medium">{score.dimensionName}</span>
              <span className="opacity-80">
                {" "}
                — continue lessons and practice to strengthen this area.
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
