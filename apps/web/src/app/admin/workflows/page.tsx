import { AdminPageGate, PageHeader } from "../../../components/patterns/AdminPageGate";
import { WorkflowsAdmin } from "../../../features/admin/workflows/WorkflowsAdmin";
import { ServerApiError, serverApi } from "../../../lib/server-api";

type WorkflowDefinitionListResponse = {
  data: Array<{
    id: string;
    key: string;
    name: string;
    definitionJson: Record<string, unknown>;
    status: "ACTIVE" | "ARCHIVED" | "DRAFT";
    updatedAt: string;
  }>;
};

export default async function AdminWorkflowsPage() {
  try {
    const definitions = await serverApi.get<WorkflowDefinitionListResponse>(
      "/api/v1/workflows?view=definitions",
    );

    return (
      <AdminPageGate screenId="T17" state="ready" title="Workflows">
        <main className="space-y-6">
          <PageHeader
            title="Workflows"
            description="Configure tenant workflow definitions. Use Review & Approvals for human transitions."
          />
          <WorkflowsAdmin definitions={definitions.data} />
        </main>
      </AdminPageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <AdminPageGate
          screenId="T17"
          state="denied"
          title="Workflows"
          deniedMessage="You do not have permission to manage workflow definitions."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <AdminPageGate
          screenId="T17"
          state="error"
          title="Workflows"
          errorMessage={`Failed to load workflow definitions. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
