import type { z } from "zod";
import { redirect } from "next/navigation";
import { PageGate } from "../../../components/patterns/PageGate";
import { AttemptRunner } from "../../../features/assessments/components/attempt-runner";
import { ServerApiError, serverApi } from "../../../lib/server-api";
import type { attemptRunnerResponseSchema } from "../../../features/assessments/assessment-response-schemas";

type AttemptResponse = z.infer<typeof attemptRunnerResponseSchema>;

type AttemptRunnerPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AttemptRunnerPage({ params }: AttemptRunnerPageProps) {
  const { id } = await params;

  try {
    const attempt = await serverApi.get<AttemptResponse>(`/api/v1/attempts/${id}`);

    if (attempt.data.status !== "STARTED") {
      redirect(`/attempts/${id}/result`);
    }

    return (
      <PageGate state="ready" title="Attempt runner">
        <main>
          <AttemptRunner initialAttempt={attempt.data} />
        </main>
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 403 || error.status === 404)) {
      return (
        <PageGate
          state="denied"
          title="Attempt runner"
          deniedMessage="You do not have access to this attempt."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <PageGate
          state="error"
          title="Attempt runner"
          errorMessage={`Failed to load attempt. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
