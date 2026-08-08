import { PageGate } from "../../../../components/patterns/PageGate";
import { GradingDetailPanel } from "../../../../features/grading/components/grading-detail-panel";
import { ServerApiError, serverApi } from "../../../../lib/server-api";
import type { z } from "zod";
import type { gradingTaskDetailResponseSchema } from "@atlas/contracts/grading/grading-schemas";

type GradingTaskDetailResponse = z.infer<typeof gradingTaskDetailResponseSchema>;

type GradingDetailPageProps = {
  params: Promise<{ taskId: string }>;
};

export default async function StudioGradingDetailPage({ params }: GradingDetailPageProps) {
  const { taskId } = await params;

  try {
    const detail = await serverApi.get<GradingTaskDetailResponse>(
      `/api/v1/grading-tasks/${taskId}`,
    );

    return (
      <PageGate state="ready" title="Grading Detail">
        <GradingDetailPanel task={detail.data} />
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <PageGate
          state="denied"
          title="Grading Detail"
          deniedMessage="You do not have permission to grade this task."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <PageGate
          state="error"
          title="Grading Detail"
          errorMessage={`Failed to load grading task. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
