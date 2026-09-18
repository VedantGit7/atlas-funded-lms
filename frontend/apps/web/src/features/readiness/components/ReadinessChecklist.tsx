import Link from "next/link";
import { ArrowUpRight, CircleCheckBig, CircleDot, Sparkles } from "lucide-react";
import type { z } from "zod";
import type { myCompetencyResponseSchema } from "@atlas/contracts/competency/competency-projection.schemas";

type CompetencyScore = z.infer<typeof myCompetencyResponseSchema>["data"]["scores"][number];

type ReadinessChecklistProps = {
  scores: CompetencyScore[];
};

const GAP_THRESHOLD = 60;

export function ReadinessChecklist({ scores }: ReadinessChecklistProps) {
  const gaps = scores
    .filter((score) => score.bandKey == null || score.score < GAP_THRESHOLD)
    .sort((a, b) => a.score - b.score);

  return (
    <section
      aria-label="Improvement focus"
      className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card"
    >
      <header className="flex items-center justify-between gap-3 border-b border-border px-6 py-4">
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--warning)_16%,transparent)] text-[var(--warning)]">
            <Sparkles className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          </span>
          Improvement focus
        </h2>
        {gaps.length > 0 ? (
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {gaps.length} to strengthen
          </span>
        ) : null}
      </header>

      {gaps.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--success)_14%,transparent)] text-[var(--success)]">
            <CircleCheckBig className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
          </span>
          <p className="text-sm text-muted-foreground">
            No major gaps across your tracked dimensions. Keep the momentum going.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {gaps.map((score) => {
            const guidance =
              score.bandKey == null
                ? "No band assigned yet. Complete more activities to establish a baseline."
                : "Below your target range. Focused practice will lift this dimension.";
            return (
              <li
                key={`${score.scoringProfileId}:${score.dimensionId}`}
                className="flex items-start gap-4 px-6 py-4"
              >
                <CircleDot
                  className="mt-0.5 h-5 w-5 shrink-0 text-[var(--warning)]"
                  strokeWidth={2}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground">{score.dimensionName}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{guidance}</p>
                  <Link
                    href="/practice"
                    prefetch={false}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-primary transition-opacity hover:opacity-80"
                  >
                    Practice this area
                    <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
