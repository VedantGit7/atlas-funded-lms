import Link from "next/link";
import { ArrowRight, Route } from "lucide-react";
import type { z } from "zod";
import type { learningPathListResponseSchema } from "@atlas/contracts/learning-paths/learning-path.schemas";

type LearningPathItem = z.infer<typeof learningPathListResponseSchema>["data"]["items"][number];

const PATH_TYPE_LABELS: Record<LearningPathItem["pathType"], string> = {
  roadmap: "Roadmap",
  program: "Program",
};

/**
 * Published learning paths as cards (QA review 2 H19: a published path had no
 * way in from the learner menu or the catalogue).
 */
export function LearningPathCards({
  paths,
  heading,
  description,
}: {
  paths: LearningPathItem[];
  heading: string;
  description?: string;
}) {
  if (paths.length === 0) return null;
  return (
    <section aria-labelledby="learning-path-cards-heading" className="space-y-3">
      <div>
        <h2
          id="learning-path-cards-heading"
          className="text-lg font-bold tracking-tight text-foreground"
        >
          {heading}
        </h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {paths.map((path) => (
          <li key={path.id}>
            <Link
              href={`/paths/${path.id}`}
              className="group flex h-full flex-col rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-primary">
                <Route className="h-3.5 w-3.5" aria-hidden="true" />
                {PATH_TYPE_LABELS[path.pathType]}
              </span>
              <span className="mt-2 text-base font-bold text-foreground">{path.title}</span>
              {path.description ? (
                <span className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {path.description}
                </span>
              ) : null}
              <span className="mt-auto inline-flex items-center gap-1 pt-3 text-sm font-semibold text-primary">
                View path
                <ArrowRight
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
