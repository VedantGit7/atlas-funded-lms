import type { z } from "zod";
import { PageGate } from "../../../../components/patterns/PageGate";
import { AttemptResultPanel } from "../../../../features/assessments/components/attempt-result";
import { ServerApiError, serverApi } from "../../../../lib/server-api";
import type { attemptRunnerResponseSchema } from "../../../../features/assessments/assessment-response-schemas";

type AttemptResponse = z.infer<typeof attemptRunnerResponseSchema>;

type AttemptResultPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AttemptResultPage({ params }: AttemptResultPageProps) {
  const { id } = await params;

  try {
    const attempt = await serverApi.get<AttemptResponse>(`/api/v1/attempts/${id}`);

    return (
      <PageGate state="ready" title="Attempt result">
        <main>
          <AttemptResultPanel attempt={attempt.data} />
        </main>
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 403 || error.status === 404)) {
      return (
        <PageGate
          state="denied"
          title="Attempt result"
          deniedMessage="You do not have access to this attempt result."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <PageGate
          state="error"
          title="Attempt result"
          errorMessage={`Failed to load attempt result. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
