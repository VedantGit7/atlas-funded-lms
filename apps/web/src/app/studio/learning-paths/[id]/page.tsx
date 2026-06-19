import type { z } from "zod";
import { PageGate, PageHeader } from "../../../../components/patterns/PageGate";
import { StudioLearningPathDetailClient } from "../../../../features/learning-paths/components/StudioLearningPathDetailClient";
import { ServerApiError, serverApi } from "../../../../lib/server-api";
import type { learningPathDetailResponseSchema } from "../../../../server/learning-paths/learning-path.schemas";

type LearningPathDetailResponse = z.infer<typeof learningPathDetailResponseSchema>;

type StudioLearningPathDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function StudioLearningPathDetailPage({
  params,
}: StudioLearningPathDetailPageProps) {
  const { id } = await params;

  try {
    const detail = await serverApi.get<LearningPathDetailResponse>(
      `/api/v1/learning-paths/${id}?view=studio`,
    );

    return (
      <PageGate state="ready" title="Learning path builder">
        <main className="space-y-6">
          <PageHeader title={detail.data.title} description="Edit metadata, steps, and gates." />
          <StudioLearningPathDetailClient path={detail.data} />
        </main>
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <PageGate
          state="denied"
          title="Learning path builder"
          deniedMessage="You do not have permission to edit this path."
        />
      );
    }

    if (error instanceof ServerApiError && error.status === 404) {
      return (
        <PageGate
          state="not_found"
          title="Learning path builder"
          notFoundMessage="This path was not found."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <PageGate
          state="error"
          title="Learning path builder"
          errorMessage={`Failed to load path. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
