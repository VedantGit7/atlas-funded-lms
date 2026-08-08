import type { ResourceListResponse } from "@atlas/contracts/resources/schemas";
import { PageGate, PageHeader } from "../../../components/patterns/PageGate";
import { ResourceLibrary } from "../../../features/resources/ResourceLibrary";
import { ServerApiError, serverApi } from "../../../lib/server-api";

export default async function ResourcesPage() {
  try {
    const response = await serverApi.get<ResourceListResponse>(
      "/api/v1/me/resources?limit=24&sort=recent",
    );

    return (
      <PageGate state="ready" title="Resource library">
        <main className="mx-auto w-full max-w-6xl space-y-6">
          <PageHeader
            title="Resource library"
            description="A browsable repository of supplementary learning materials from your courses: technical guides, reports, external links, and video walk-throughs."
          />
          <ResourceLibrary
            initialItems={response.data.items}
            initialPageInfo={response.data.pageInfo}
            initialTotal={response.data.total}
            facets={response.data.facets}
          />
        </main>
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <PageGate
          state="denied"
          title="Resource library"
          deniedMessage="Sign in with an active membership to browse resources."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <PageGate
          state="error"
          title="Resource library"
          errorMessage={`Failed to load resources. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
