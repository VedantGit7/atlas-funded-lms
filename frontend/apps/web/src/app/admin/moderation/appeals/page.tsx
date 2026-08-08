import { PageGate } from "../../../../components/patterns/PageGate";
import { AppealsReviewClient } from "../../../../features/moderation/components/AppealsReviewClient";
import { ServerApiError, serverApi } from "../../../../lib/server-api";
import type { z } from "zod";
import type { moderationCaseListResponseSchema } from "@atlas/contracts/moderation/moderation.dto";

type ModerationCaseListResponse = z.infer<typeof moderationCaseListResponseSchema>;

export default async function AdminModerationAppealsPage() {
  try {
    await serverApi.get<ModerationCaseListResponse>("/api/v1/moderation/cases?view=appeals");

    const meResponse = await serverApi.get<{
      data: {
        membership: { id: string };
      };
    }>("/api/v1/me");

    return (
      <PageGate state="ready" title="Appeals review">
        <main>
          <AppealsReviewClient viewerMembershipId={meResponse.data.membership.id} />
        </main>
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <PageGate
          state="denied"
          title="Appeals review"
          deniedMessage="You do not have permission to review appeals."
        />
      );
    }

    if (error instanceof ServerApiError && error.code === "ENTITLEMENT_REQUIRED") {
      return (
        <PageGate
          state="denied"
          title="Appeals review"
          deniedMessage="Community moderation requires the community entitlement."
        />
      );
    }

    throw error;
  }
}
