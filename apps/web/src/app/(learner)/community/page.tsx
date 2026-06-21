import { PageGate, PageHeader } from "../../../components/patterns/PageGate";
import { CommunityHub } from "../../../features/community/components/CommunityHub";
import { ServerApiError } from "../../../lib/server-api";
import { communityServerApi } from "../../../modules/community/community.server-api";

export default async function CommunityPage() {
  try {
    const spaces = await communityServerApi.listSpaces();

    return (
      <PageGate state="ready" title="Community">
        <main className="space-y-6">
          <PageHeader
            title="Community"
            description="Discover spaces, join discussions, and connect with other learners."
          />
          <CommunityHub spaces={spaces.data.items} />
        </main>
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError) {
      if (error.code === "ENTITLEMENT_REQUIRED") {
        return (
          <PageGate
            state="denied"
            title="Community"
            deniedMessage="Community is not enabled for this tenant."
          />
        );
      }

      if (error.status === 401 || error.status === 403) {
        return (
          <PageGate
            state="denied"
            title="Community"
            deniedMessage="You do not have permission to view community spaces."
          />
        );
      }

      return (
        <PageGate
          state="error"
          title="Community"
          errorMessage={`Failed to load community. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
