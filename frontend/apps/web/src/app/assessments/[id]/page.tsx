import type { z } from "zod";
import { PageGate } from "../../../components/patterns/PageGate";
import { AssessmentOverviewPanel } from "../../../features/assessments/components/assessment-overview";
import { ServerApiError, serverApi } from "../../../lib/server-api";
import type { learnerAssessmentOverviewResponseSchema } from "../../../features/assessments/assessment-response-schemas";

type OverviewResponse = z.infer<typeof learnerAssessmentOverviewResponseSchema>;

type AssessmentOverviewPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AssessmentOverviewPage({ params }: AssessmentOverviewPageProps) {
  const { id } = await params;

  try {
    const overview = await serverApi.get<OverviewResponse>(
      `/api/v1/assessments/${id}?view=learner`,
    );

    return (
      <PageGate state="ready" title="Assessment overview">
        <main>
          <AssessmentOverviewPanel overview={overview.data} />
        </main>
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 403 || error.status === 404)) {
      return (
        <PageGate
          state="not_found"
          title="Assessment overview"
          notFoundMessage="Assessment not found or not available."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <PageGate
          state="error"
          title="Assessment overview"
          errorMessage={`Failed to load assessment. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
