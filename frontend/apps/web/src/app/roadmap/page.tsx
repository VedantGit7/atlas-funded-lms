import Link from "next/link";
import { ExternalLink, RouteOff } from "lucide-react";
import type { z } from "zod";
import { PageGate } from "../../components/patterns/PageGate";
import { RoadmapJourney } from "../../features/learning-paths/components/RoadmapJourney";
import { ServerApiError, serverApi } from "../../lib/server-api";
import type {
  learningPathListResponseSchema,
  pathProgressResponseSchema,
} from "@atlas/contracts/learning-paths/learning-path.schemas";

type LearningPathListResponse = z.infer<typeof learningPathListResponseSchema>;
type PathProgressResponse = z.infer<typeof pathProgressResponseSchema>;

export default async function RoadmapPage() {
  try {
    const paths = await serverApi.get<LearningPathListResponse>(
      "/api/v1/learning-paths?type=roadmap&limit=10",
    );
    const roadmap = paths.data.items[0];

    if (!roadmap) {
      return (
        <PageGate state="ready" title="Roadmap">
          <div className="mx-auto flex max-w-md flex-col items-center rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <RouteOff className="h-6 w-6" aria-hidden="true" />
            </span>
            <h1 className="mt-3 text-lg font-bold text-foreground">No roadmap yet</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Your academy has not published a learning roadmap. Browse the catalog to start learning in the meantime.
            </p>
            <Link
              href="/courses"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Browse courses
            </Link>
          </div>
        </PageGate>
      );
    }

    const progress = await serverApi.get<PathProgressResponse>(
      `/api/v1/learning-paths/${roadmap.id}/progress`,
    );

    return (
      <PageGate state="ready" title="Roadmap">
        <div className="mx-auto max-w-3xl space-y-8 pb-16">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">{roadmap.title}</h1>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                {roadmap.description ??
                  "A step-by-step path to mastery. Every node brings you closer to professional proficiency."}
              </p>
            </div>
            <Link
              href={`/paths/${roadmap.id}`}
              className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-primary hover:underline"
            >
              View full path details
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </Link>
          </header>
          <RoadmapJourney
            pathId={roadmap.id}
            detailHref={`/paths/${roadmap.id}`}
            enrolled={progress.data.enrolled}
            completedStepCount={progress.data.completedStepCount}
            totalStepCount={progress.data.totalStepCount}
            currentStepId={progress.data.currentStepId}
            enrolledAt={progress.data.enrolledAt}
            nextAction={progress.data.nextAction}
            steps={progress.data.steps}
          />
        </div>
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <PageGate
          state="denied"
          title="Roadmap"
          deniedMessage="You do not have permission to view the roadmap."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <PageGate
          state="error"
          title="Roadmap"
          errorMessage={`Failed to load roadmap. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
