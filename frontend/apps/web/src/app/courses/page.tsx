import type { z } from "zod";
import { PageGate } from "../../components/patterns/PageGate";
import { CourseCatalog } from "../../features/courses/course-catalog";
import type { CourseFilterValues } from "../../features/courses/course-filters";
import { ServerApiError, serverApi } from "../../lib/server-api";
import type { courseListResponseSchema } from "@atlas/contracts/courses/schemas";

type CourseListResponse = z.infer<typeof courseListResponseSchema>;

type CoursesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readSearchParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const value = params[key];
  if (Array.isArray(value)) return value[0];
  return value;
}

function buildInitialFilters(
  params: Record<string, string | string[] | undefined>,
): CourseFilterValues {
  const filters: CourseFilterValues = {};
  const q = readSearchParam(params, "q");
  const stage = readSearchParam(params, "stage");
  const dimension = readSearchParam(params, "dimension");
  const persona = readSearchParam(params, "persona");
  const certificate = readSearchParam(params, "certificate");
  const sort = readSearchParam(params, "sort");

  if (q) filters.q = q;
  if (stage) filters.stage = stage;
  if (dimension) filters.dimension = dimension;
  if (persona) filters.persona = persona;
  if (certificate) filters.certificate = certificate;
  if (sort) filters.sort = sort;

  return filters;
}

export default async function CoursesPage({ searchParams }: CoursesPageProps) {
  const params = await searchParams;
  const query = new URLSearchParams();

  for (const key of [
    "q",
    "stage",
    "dimension",
    "persona",
    "certificate",
    "sort",
    "cursor",
  ] as const) {
    const value = readSearchParam(params, key);
    if (value) query.set(key, value);
  }

  const path = query.size > 0 ? `/api/v1/courses?${query.toString()}` : "/api/v1/courses";

  try {
    const catalog = await serverApi.get<CourseListResponse>(path);

    return (
      <PageGate state="ready" title="Course catalog">
        <CourseCatalog
          initialItems={catalog.data.items}
          pageInfo={catalog.data.pageInfo}
          initialFilters={buildInitialFilters(params)}
        />
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError) {
      if (error.status === 401 || error.status === 403) {
        return (
          <PageGate
            state="denied"
            title="Course catalog"
            deniedMessage="Sign in with an active membership to browse courses."
          />
        );
      }

      if (error.code === "MEMBERSHIP_SUSPENDED") {
        return (
          <PageGate
            state="denied"
            title="Course catalog"
            deniedMessage="Your membership is suspended and cannot access the course catalog."
          />
        );
      }
    }

    throw error;
  }
}
