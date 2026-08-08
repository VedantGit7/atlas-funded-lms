import { PageGate } from "../../../components/patterns/PageGate";
import { GradingQueueClient } from "../../../features/grading/grading-queue-client";
import { ServerApiError, serverApi } from "../../../lib/server-api";
import type { z } from "zod";
import type { gradingListResponseSchema } from "@atlas/contracts/grading/grading-schemas";

type GradingListResponse = z.infer<typeof gradingListResponseSchema>;

export default async function StudioGradingPage() {
  try {
    const initialQueue = await serverApi.get<GradingListResponse>(
      "/api/v1/grading-tasks?assignedTo=me",
    );

    return (
      <PageGate state="ready" title="Grading Queue">
        <GradingQueueClient initialTasks={initialQueue.data} />
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <PageGate
          state="denied"
          title="Grading Queue"
          deniedMessage="You do not have permission to access the grading queue."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <PageGate
          state="error"
          title="Grading Queue"
          errorMessage={`Failed to load grading queue. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
