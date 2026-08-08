import { PageGate } from "../../../../../components/patterns/PageGate";
import { ModerationCaseDetailClient } from "../../../../../features/moderation/components/ModerationCaseDetailClient";
import { ServerApiError, serverApi } from "../../../../../lib/server-api";
import type { z } from "zod";
import type { moderationCaseListResponseSchema } from "@atlas/contracts/moderation/moderation.dto";

type ModerationCaseListResponse = z.infer<typeof moderationCaseListResponseSchema>;

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminModerationCaseDetailPage({ params }: PageProps) {
  const { id } = await params;

  try {
    await serverApi.get<ModerationCaseListResponse>(`/api/v1/moderation/cases?caseId=${id}`);

    return (
      <PageGate state="ready" title="Moderation case">
        <main>
          <ModerationCaseDetailClient caseId={id} />
        </main>
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && error.status === 404) {
      return (
        <PageGate
          state="not_found"
          title="Moderation case"
          notFoundMessage="Case not found or access is denied."
        />
      );
    }

    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <PageGate
          state="denied"
          title="Moderation case"
          deniedMessage="You do not have permission to access this moderation case."
        />
      );
    }

    if (error instanceof ServerApiError && error.code === "ENTITLEMENT_REQUIRED") {
      return (
        <PageGate
          state="denied"
          title="Moderation case"
          deniedMessage="Community moderation requires the community entitlement."
        />
      );
    }

    throw error;
  }
}
