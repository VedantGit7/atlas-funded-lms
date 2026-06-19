import type { z } from "zod";
import { PageGate, PageHeader } from "../../../components/patterns/PageGate";
import { EnrollPathButton } from "../../../features/learning-paths/components/EnrollPathButton";
import { PathStepList } from "../../../features/learning-paths/components/PathStepList";
import { ServerApiError, serverApi } from "../../../lib/server-api";
import type {
  learningPathDetailResponseSchema,
  pathProgressResponseSchema,
} from "../../../server/learning-paths/learning-path.schemas";

type LearningPathDetailResponse = z.infer<typeof learningPathDetailResponseSchema>;
type PathProgressResponse = z.infer<typeof pathProgressResponseSchema>;

type PathDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function PathDetailPage({ params }: PathDetailPageProps) {
  const { id } = await params;

  try {
    const [detail, progress] = await Promise.all([
      serverApi.get<LearningPathDetailResponse>(`/api/v1/learning-paths/${id}`),
      serverApi.get<PathProgressResponse>(`/api/v1/learning-paths/${id}/progress`),
    ]);

    return (
      <PageGate state="ready" title="Learning path">
        <main className="space-y-6">
          <PageHeader
            title={detail.data.title}
            description={detail.data.description ?? "Review steps, gates, and progress."}
          />
          <div className="rounded border p-4">
            <p className="text-sm opacity-80">
              Progress: {progress.data.completedStepCount} / {progress.data.totalStepCount}
            </p>
            <p className="text-sm">{progress.data.nextAction.label}</p>
          </div>
          <EnrollPathButton pathId={id} enrolled={progress.data.enrolled} />
          <PathStepList steps={detail.data.steps} progressSteps={progress.data.steps} />
        </main>
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <PageGate
          state="denied"
          title="Learning path"
          deniedMessage="You do not have permission to view this path."
        />
      );
    }

    if (error instanceof ServerApiError && error.status === 404) {
      return (
        <PageGate
          state="not_found"
          title="Learning path"
          notFoundMessage="This path was not found or is not available."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <PageGate
          state="error"
          title="Learning path"
          errorMessage={`Failed to load path. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
