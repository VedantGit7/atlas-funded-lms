import { PageGate } from "../../../components/patterns/PageGate";
import { SwipePracticeClient } from "../../../features/practice/components/SwipePracticeClient";
import { ServerApiError } from "../../../lib/server-api";
import { practiceServerApi } from "@/modules/practice/practice.server-api";

export default async function PracticePage() {
  try {
    const due = await practiceServerApi.getDueQueue({ limit: 20 });

    return (
      <PageGate state="ready" title="Practice">
        <SwipePracticeClient initialDue={due.data} />
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <PageGate
          state="denied"
          title="Practice"
          deniedMessage="You do not have permission to start practice."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <PageGate
          state="error"
          title="Practice"
          errorMessage={`Failed to load practice. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
