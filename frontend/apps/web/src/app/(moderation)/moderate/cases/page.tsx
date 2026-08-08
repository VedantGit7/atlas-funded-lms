import { PageGate, PageHeader } from "../../../../components/patterns/PageGate";
import { ModerationQueueClient } from "../../../../features/moderation/components/ModerationQueueClient";
import { ServerApiError, serverApi } from "../../../../lib/server-api";
import type { z } from "zod";
import type { moderationCaseListResponseSchema } from "../../../../server/moderation/moderation.dto";

type ModerationCaseListResponse = z.infer<typeof moderationCaseListResponseSchema>;

export default async function ModerationCasesPage() {
  try {
    await serverApi.get<ModerationCaseListResponse>("/api/v1/moderation/cases?view=cases");

    return (
      <PageGate state="ready" title="Moderation queue">
        <main className="space-y-6">
          <PageHeader
            title="Moderation queue"
            description="Review open moderation cases and begin review on new reports."
          />
          <ModerationQueueClient />
        </main>
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <PageGate
          state="denied"
          title="Moderation queue"
          deniedMessage="You do not have permission to access the moderation queue."
        />
      );
    }

    if (error instanceof ServerApiError && error.code === "ENTITLEMENT_REQUIRED") {
      return (
        <PageGate
          state="denied"
          title="Moderation queue"
          deniedMessage="Community moderation requires the community entitlement."
        />
      );
    }

    throw error;
  }
}
