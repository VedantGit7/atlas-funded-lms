import type { z } from "zod";
import { PageGate } from "../../../components/patterns/PageGate";
import { AssessmentManager } from "../../../features/assessments/components/AssessmentManager";
import { ServerApiError, serverApi } from "../../../lib/server-api";
import type { assessmentListResponseSchema } from "../../../features/assessments/assessment-response-schemas";

type AssessmentListResponse = z.infer<typeof assessmentListResponseSchema>;

export default async function StudioAssessmentsPage() {
  try {
    const assessments = await serverApi.get<AssessmentListResponse>("/api/v1/assessments");

    return (
      <PageGate state="ready" title="Assessments">
        <main className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--admin-on-surface)] md:text-3xl">
              Assessments
            </h1>
            <p className="mt-0.5 text-sm text-[var(--admin-on-surface-variant)]">
              Create and configure quizzes, exams, and diagnostics.
            </p>
          </div>
          <AssessmentManager assessments={assessments.data} />
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
