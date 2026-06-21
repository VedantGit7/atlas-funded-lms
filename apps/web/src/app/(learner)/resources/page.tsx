import type { z } from "zod";
import { PageGate, PageHeader } from "../../../components/patterns/PageGate";
import { CourseCatalog } from "../../../features/courses/course-catalog";
import { ServerApiError, serverApi } from "../../../lib/server-api";
import type { courseListResponseSchema } from "../../../server/courses/schemas";

type CourseListResponse = z.infer<typeof courseListResponseSchema>;

export default async function ResourcesPage() {
  try {
    const catalog = await serverApi.get<CourseListResponse>(
      "/api/v1/courses?persona=resource&limit=25",
    );

    return (
      <PageGate state="ready" title="Resource library">
        <main className="space-y-6">
          <PageHeader
            title="Resource library"
            description="Browse resource-tagged learning materials available in your academy."
          />
          {catalog.data.items.length === 0 ? (
            <p className="rounded border p-6 text-sm opacity-80">
              No resource-tagged courses are published yet.
            </p>
          ) : (
            <CourseCatalog
              initialItems={catalog.data.items}
              pageInfo={catalog.data.pageInfo}
              initialFilters={{ persona: "resource" }}
            />
          )}
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
