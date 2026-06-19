import { PageGate, PageHeader } from "../../components/patterns/PageGate";
import { ReviewApprovalsClient } from "../../features/workflows/review-approvals-client";
import { ServerApiError, serverApi } from "../../lib/server-api";
import type { z } from "zod";
import type { workflowListResponseSchema } from "../../server/workflows/workflow-schemas";

type WorkflowListResponse = z.infer<typeof workflowListResponseSchema>;

export default async function ReviewApprovalsPage() {
  try {
    await serverApi.get<WorkflowListResponse>("/api/v1/workflows?status=pending&targetType=course");

    return (
      <PageGate state="ready" title="Review & Approvals">
        <main className="space-y-6">
          <PageHeader
            title="Review & Approvals"
            description="Review pending course publish submissions and act on workflow transitions."
          />
          <ReviewApprovalsClient />
        </main>
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError) {
      if (error.status === 401 || error.status === 403) {
        return (
          <PageGate
            state="denied"
            title="Review & Approvals"
            deniedMessage="You do not have permission to access the review queue."
          />
        );
      }

      return (
        <PageGate
          state="error"
          title="Review & Approvals"
          errorMessage={`Failed to load review queue. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
