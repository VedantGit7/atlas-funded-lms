import type { z } from "zod";
import type { competencyScoreDtoSchema } from "@atlas/contracts/competency/competency-projection.schemas";

type CompetencyScore = z.infer<typeof competencyScoreDtoSchema>;

type CompetencyScoreCardsProps = {
  scores: CompetencyScore[];
};

export function CompetencyScoreCards({ scores }: CompetencyScoreCardsProps) {
  if (scores.length === 0) {
    return (
      <section className="rounded border p-6">
        <h2 className="font-medium">Competency scores</h2>
        <p className="mt-2 text-sm opacity-80">
          No competency scores yet. Complete assessments or practice sessions to build your profile.
        </p>
      </section>
    );
  }

  const grouped = scores.reduce<Record<string, CompetencyScore[]>>((acc, score) => {
    const key = score.scoringProfileKey;
    acc[key] = acc[key] ?? [];
    acc[key].push(score);
    return acc;
  }, {});

  return (
    <section className="space-y-6">
      {Object.entries(grouped).map(([profileKey, profileScores]) => (
        <div key={profileKey} className="space-y-3">
          <h2 className="font-medium">{profileKey} profile</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {profileScores.map((score) => (
              <article
                key={`${score.scoringProfileId}-${score.dimensionId}`}
                className="rounded border p-4"
              >
                <p className="text-sm opacity-70">{score.dimensionName}</p>
                <p className="text-2xl font-semibold">{score.score.toFixed(1)}</p>
                {score.bandLabel ? (
                  <p className="text-sm opacity-80">Band: {score.bandLabel}</p>
                ) : score.bandKey ? (
                  <p className="text-sm opacity-80">Band: {score.bandKey}</p>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
