import type { z } from "zod";
import { PageGate } from "../../../../components/patterns/PageGate";
import { AssessmentBuilderLazy } from "../../../../features/assessments/components/assessment-builder-lazy";
import { ServerApiError, serverApi } from "../../../../lib/server-api";
import type { assessmentDetailResponseSchema } from "../../../../features/assessments/assessment-response-schemas";
import type { itemListResponseSchema } from "../../../../features/item-registry/item-registry-response-schemas";

type AssessmentDetailResponse = z.infer<typeof assessmentDetailResponseSchema>;
type ItemListResponse = z.infer<typeof itemListResponseSchema>;

type StudioAssessmentBuilderPageProps = {
  params: Promise<{ id: string }>;
};

export default async function StudioAssessmentBuilderPage({
  params,
}: StudioAssessmentBuilderPageProps) {
  const { id } = await params;

  try {
    const [assessment, items] = await Promise.all([
      serverApi.get<AssessmentDetailResponse>(`/api/v1/assessments/${id}`),
      serverApi.get<ItemListResponse>("/api/v1/items"),
    ]);

    return (
      <PageGate state="ready" title="Assessment builder">
        <main className="space-y-4">
          <AssessmentBuilderLazy
            initialAssessment={assessment.data}
            availableItems={items.data.map((item) => ({
              id: item.id,
              itemTypeKey: item.itemTypeKey,
              contentJson: item.contentJson as Record<string, unknown>,
            }))}
          />
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
