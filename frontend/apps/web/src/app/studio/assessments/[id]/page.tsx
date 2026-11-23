import type { z } from "zod";
import { PageGate } from "../../../../components/patterns/PageGate";
import { AssessmentBuilderLazy } from "../../../../features/assessments/components/assessment-builder-lazy";
import { ServerApiError, serverApi } from "../../../../lib/server-api";
import type { assessmentDetailResponseSchema } from "../../../../features/assessments/assessment-response-schemas";

type AssessmentDetailResponse = z.infer<typeof assessmentDetailResponseSchema>;

type StudioAssessmentBuilderPageProps = {
  params: Promise<{ id: string }>;
};

export default async function StudioAssessmentBuilderPage({
  params,
}: StudioAssessmentBuilderPageProps) {
  const { id } = await params;

  try {
    // Questions are picked from the whole Item Bank in the builder (QA review 1 C8).
    const assessment = await serverApi.get<AssessmentDetailResponse>(`/api/v1/assessments/${id}`);

    return (
      <PageGate state="ready" title="Assessment builder">
        <main className="space-y-4">
          <AssessmentBuilderLazy initialAssessment={assessment.data} />
        </main>
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 403 || error.status === 404)) {
      return (
        <PageGate
          state="not_found"
          title="Assessment builder"
          notFoundMessage="Assessment not found or access denied."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <PageGate
          state="error"
          title="Assessment builder"
          errorMessage={`Failed to load assessment. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
