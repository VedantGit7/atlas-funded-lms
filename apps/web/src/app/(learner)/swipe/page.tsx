import { PageGate, PageHeader } from "../../../components/patterns/PageGate";
import { SwipePracticeClient } from "../../../features/practice/components/SwipePracticeClient";
import { ServerApiError } from "../../../lib/server-api";
import { practiceServerApi } from "../../../modules/practice/practice.server-api";

export default async function SwipePage() {
  try {
    const due = await practiceServerApi.getDueQueue({ limit: 20 });

    if (due.data.items.length === 0 && due.data.availableDecks.length === 0) {
      return (
        <PageGate state="ready" title="Swipe Learning">
          <main className="space-y-6">
            <PageHeader
              title="Swipe Learning"
              description="Daily binary practice with server-validated feedback."
            />
            <div className="rounded border p-6 text-sm text-neutral-600">
              No swipe cards are available yet. Published swipe decks will appear here when your
              tenant adds practice content.
            </div>
          </main>
        </PageGate>
      );
    }

    return (
      <PageGate state="ready" title="Swipe Learning">
        <main className="space-y-6">
          <PageHeader
            title="Swipe Learning"
            description="Review due cards or choose a deck. Responses are validated on the server."
          />
          <SwipePracticeClient initialDue={due.data} />
        </main>
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <PageGate
          state="denied"
          title="Swipe Learning"
          deniedMessage="You do not have permission to start swipe practice."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <PageGate
          state="error"
          title="Swipe Learning"
          errorMessage={`Failed to load swipe practice. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
