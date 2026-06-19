import type { z } from "zod";
import { PageGate, PageHeader } from "../../../components/patterns/PageGate";
import { LearningPathManager } from "../../../features/learning-paths/components/LearningPathManager";
import { ServerApiError, serverApi } from "../../../lib/server-api";
import type { learningPathListResponseSchema } from "../../../server/learning-paths/learning-path.schemas";

type LearningPathListResponse = z.infer<typeof learningPathListResponseSchema>;

export default async function StudioLearningPathsPage() {
  try {
    const paths = await serverApi.get<LearningPathListResponse>(
      "/api/v1/learning-paths?view=studio",
    );

    return (
      <PageGate state="ready" title="Learning paths">
        <main className="space-y-6">
          <PageHeader
            title="Learning path builder"
            description="Create and sequence paths, steps, and gates."
          />
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
