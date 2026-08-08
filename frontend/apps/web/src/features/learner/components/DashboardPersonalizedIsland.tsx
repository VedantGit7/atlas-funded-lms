import Link from "next/link";
import type { z } from "zod";
import type { learningPathListResponseSchema } from "@atlas/contracts/learning-paths/learning-path.schemas";
import { ContinueLearningCard } from "../components/ContinueLearningCard";
import { loadPersonalizedDashboardActions } from "../server/load-personalized-dashboard";

type LearningPathListResponse = z.infer<typeof learningPathListResponseSchema>;

type DashboardPersonalizedIslandProps = {
  paths: LearningPathListResponse | null;
};

export async function DashboardPersonalizedIsland({ paths }: DashboardPersonalizedIslandProps) {
  const { nextAction, continueLearning } = await loadPersonalizedDashboardActions(paths);

  return (
    <>
      <section
        className="rounded-2xl border border-border bg-card p-5 shadow-sm"
        aria-label="Next best action"
      >
        <h2 className="text-xs font-bold uppercase tracking-wide text-primary">Next best action</h2>
        <p className="mt-1 text-base font-semibold text-foreground">{nextAction.label}</p>
        <Link
          href={nextAction.href}
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          Continue
        </Link>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {continueLearning ? (
          <ContinueLearningCard
            title={continueLearning.title}
            href={continueLearning.href}
            subtitle={continueLearning.subtitle ?? null}
            progressPct={continueLearning.progressPct ?? null}
            kind={continueLearning.kind ?? "path"}
          />
        ) : (
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-bold text-foreground">Continue learning</h2>
            <p className="mt-1 text-sm text-muted-foreground">Browse the catalog to start a course.</p>
            <Link href="/courses" className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">
              Open catalog
            </Link>
          </section>
        )}

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-bold text-foreground">Recommended practice</h2>
          <p className="mt-1 text-sm text-muted-foreground">Review the cards that are due today.</p>
          <Link href="/practice" className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">
            Open practice
          </Link>
        </section>
      </div>
    </>
  );
}
