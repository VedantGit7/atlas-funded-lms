import { PageGate, PageHeader } from "../../../components/patterns/PageGate";
import { SearchResultsPage } from "../../../features/search/components/search-results-page";
import { ServerApiError, serverApi } from "../../../lib/server-api";
import type { SearchListResponse } from "../../../features/search/api";

type SearchPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const q = readParam(params["q"]).trim();
  const type = readParam(params["type"]).trim();

  try {
    const query = new URLSearchParams();
    if (q.length >= 2) query.set("q", q);
    if (type) query.set("type", type);

    const path = query.size > 0 ? `/api/v1/search?${query.toString()}` : "/api/v1/search";
    const response = await serverApi.get<SearchListResponse>(path);

    return (
      <PageGate state="ready" title="Search">
        <main className="space-y-6">
          <PageHeader
            title="Search"
            description="Find published courses, community posts, and certificates in your academy."
          />
          <SearchResultsPage
            initialQuery={q}
            {...(type ? { initialType: type } : {})}
            initialResults={response.data.items}
            initialNextCursor={response.data.pageInfo.nextCursor}
            initialHasNextPage={response.data.pageInfo.hasNextPage}
          />
        </main>
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError) {
      if (error.status === 401 || error.status === 403) {
        return (
          <PageGate
            state="denied"
            title="Search"
            deniedMessage="You do not have permission to search this academy."
          />
        );
      }

      if (error.code === "VALIDATION_ERROR") {
        return (
          <PageGate state="ready" title="Search">
            <main className="space-y-6">
              <PageHeader title="Search" description="Find content across your academy." />
              <SearchResultsPage
                initialQuery={q}
                {...(type ? { initialType: type } : {})}
                initialResults={[]}
                initialNextCursor={null}
                initialHasNextPage={false}
                errorMessage="Enter at least 2 characters to search."
              />
            </main>
          </PageGate>
        );
      }

      return (
        <PageGate
          state="error"
          title="Search"
          errorMessage={`Failed to load search results. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
