import type { z } from "zod";
import { PageGate, PageHeader } from "../../../components/patterns/PageGate";
import {
  AssessmentTable,
  CreateAssessmentDialog,
} from "../../../features/assessments/components/assessment-table";
import { ServerApiError, serverApi } from "../../../lib/server-api";
import type { assessmentListResponseSchema } from "../../../features/assessments/assessment-response-schemas";

type AssessmentListResponse = z.infer<typeof assessmentListResponseSchema>;

export default async function StudioAssessmentsPage() {
  try {
    const assessments = await serverApi.get<AssessmentListResponse>("/api/v1/assessments");

    return (
      <PageGate state="ready" title="Assessments">
        <main className="space-y-6">
          <PageHeader
            title="Assessments"
            description="Create and configure quizzes, exams, and diagnostics."
          />
          <CreateAssessmentDialog />
          {assessments.data.length === 0 ? (
            <div className="rounded border p-6">
              <h2>No assessments yet</h2>
              <p>Create your first assessment to compose items from the item bank.</p>
            </div>
          ) : (
            <AssessmentTable assessments={assessments.data} />
          )}
        </main>
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <PageGate
          state="denied"
          title="Assessments"
          deniedMessage="You do not have permission to manage assessments."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <PageGate
          state="error"
          title="Assessments"
          errorMessage={`Failed to load assessments. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
