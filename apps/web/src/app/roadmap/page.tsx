import Link from "next/link";
import type { z } from "zod";
import { PageGate, PageHeader } from "../../components/patterns/PageGate";
import { RoadmapTimeline } from "../../features/learning-paths/components/RoadmapTimeline";
import { ServerApiError, serverApi } from "../../lib/server-api";
import type {
  learningPathListResponseSchema,
  pathProgressResponseSchema,
} from "../../server/learning-paths/learning-path.schemas";

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
          <main className="space-y-4">
            <PageHeader
              title="Roadmap"
              description="Your tenant has not published a roadmap yet."
            />
            <div className="rounded border p-6">
              <p>No published roadmap is available.</p>
            </div>
          </main>
        </PageGate>
      );
    }

    const progress = await serverApi.get<PathProgressResponse>(
      `/api/v1/learning-paths/${roadmap.id}/progress`,
    );

    return (
      <PageGate state="ready" title="Roadmap">
        <main className="space-y-6">
          <PageHeader
            title={roadmap.title}
            description={roadmap.description ?? "Follow your staged learning path."}
          />
          <p className="text-sm opacity-80">{progress.data.nextAction.label}</p>
          <RoadmapTimeline
            pathTitle={roadmap.title}
            steps={progress.data.steps}
            currentStepId={progress.data.currentStepId}
          />
          <Link href={`/paths/${roadmap.id}`} className="text-sm underline">
            View path details
          </Link>
        </main>
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
