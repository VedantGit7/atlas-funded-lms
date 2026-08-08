import type { z } from "zod";
import { AdminPageGate } from "../../../components/patterns/AdminPageGate";
import { ReviewApprovalsClient } from "../../../features/workflows/review-approvals-client";
import { ServerApiError, serverApi } from "../../../lib/server-api";
import type { workflowListResponseSchema } from "@atlas/contracts/workflows/workflow-schemas";

type WorkflowListResponse = z.infer<typeof workflowListResponseSchema>;

export default async function AdminReviewApprovalsPage() {
  try {
    const workflowResponse = await serverApi.get<WorkflowListResponse>(
      "/api/v1/workflows?status=pending",
    );

    return (
      <AdminPageGate screenId="T25" state="ready" title="Review & Approvals">
        <ReviewApprovalsClient initialItems={workflowResponse.data} />
      </AdminPageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <AdminPageGate
          screenId="T25"
          state="denied"
          title="Review & Approvals"
          deniedMessage="You do not have permission to access the review queue."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <AdminPageGate
          screenId="T25"
          state="error"
          title="Review & Approvals"
          errorMessage={`Failed to load review queue. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
