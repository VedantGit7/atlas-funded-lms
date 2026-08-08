import type { z } from "zod";
import { PageGate } from "../../../components/patterns/PageGate";
import { LearningPathManager } from "../../../features/learning-paths/components/LearningPathManager";
import { ServerApiError, serverApi } from "../../../lib/server-api";
import type { learningPathListResponseSchema } from "@atlas/contracts/learning-paths/learning-path.schemas";

type LearningPathListResponse = z.infer<typeof learningPathListResponseSchema>;

export default async function StudioLearningPathsPage() {
  try {
    const paths = await serverApi.get<LearningPathListResponse>(
      "/api/v1/learning-paths?view=studio",
    );

    return (
      <PageGate state="ready" title="Learning paths">
        <main className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--admin-on-surface)] md:text-3xl">
              Learning path builder
            </h1>
            <p className="mt-0.5 text-sm text-[var(--admin-on-surface-variant)]">
              Create and sequence paths, steps, and gates for structured learner journeys.
            </p>
          </div>
          <LearningPathManager paths={paths.data.items} />
        </main>
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <PageGate
          state="denied"
          title="Learning paths"
          deniedMessage="You do not have permission to manage learning paths."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <PageGate
          state="error"
          title="Learning paths"
          errorMessage={`Failed to load learning paths. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
