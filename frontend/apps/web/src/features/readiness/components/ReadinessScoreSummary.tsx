import { Layers } from "lucide-react";
import type { z } from "zod";
import type { myCompetencyResponseSchema } from "@atlas/contracts/competency/competency-projection.schemas";
import { ScoreGauge } from "./ScoreGauge";
import { formatBandLabel, readinessTone } from "../readiness-view";

type CompetencyScore = z.infer<typeof myCompetencyResponseSchema>["data"]["scores"][number];

type ReadinessScoreSummaryProps = {
  scores: CompetencyScore[];
};

export function ReadinessScoreSummary({ scores }: ReadinessScoreSummaryProps) {
  if (scores.length === 0) {
    return (
      <section aria-label="Competency dimensions" className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Dimension breakdown</h2>
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Layers className="h-6 w-6" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <p className="mt-4 text-sm text-muted-foreground">
            No competency dimensions recorded yet. They appear here as you complete activities.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Competency dimensions" className="space-y-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-semibold text-foreground">Dimension breakdown</h2>
        <span className="text-xs text-muted-foreground">
          {scores.length} {scores.length === 1 ? "dimension" : "dimensions"}
        </span>
      </div>

      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {scores.map((score) => {
          const tone = readinessTone(score.score);
          const bandLabel = formatBandLabel(score.bandLabel ?? score.bandKey);
          const rounded = Math.round(score.score);
          return (
            <li
              key={`${score.scoringProfileId}:${score.dimensionId}`}
              className="group flex flex-col items-center rounded-2xl border border-border bg-card p-6 text-center transition-colors hover:border-[var(--ring)]"
            >
              <ScoreGauge
                score={score.score}
                color={tone.gaugeColor}
                variant="mini"
                ariaLabel={`${score.dimensionName} score ${String(rounded)} of 100, band ${bandLabel}`}
              />
              <h3 className="mt-4 text-base font-semibold text-foreground">
                {score.dimensionName}
              </h3>
              <span
                className={`mt-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${tone.chipClassName}`}
              >
                {bandLabel}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
