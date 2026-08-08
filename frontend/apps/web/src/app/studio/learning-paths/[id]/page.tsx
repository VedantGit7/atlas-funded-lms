import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { z } from "zod";
import { PageGate } from "../../../../components/patterns/PageGate";
import { LearningPathBuilderLazy } from "../../../../features/learning-paths/components/learning-path-builder-lazy";
import {
  PATH_TYPE_CONFIG,
  STATUS_CONFIG,
  STATUS_LABELS,
  badgeClassName,
} from "../../../../features/learning-paths/learning-path-studio-shared";
import { ServerApiError, serverApi } from "../../../../lib/server-api";
import type { learningPathDetailResponseSchema } from "@atlas/contracts/learning-paths/learning-path.schemas";

type LearningPathDetailResponse = z.infer<typeof learningPathDetailResponseSchema>;

type StudioLearningPathDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function StudioLearningPathDetailPage({
  params,
}: StudioLearningPathDetailPageProps) {
  const { id } = await params;

  try {
    const detail = await serverApi.get<LearningPathDetailResponse>(
      `/api/v1/learning-paths/${id}?view=studio`,
    );

    const typeCfg = PATH_TYPE_CONFIG[detail.data.pathType];

    return (
      <PageGate state="ready" title="Learning path builder">
        <main className="space-y-4">
          <div>
            <nav className="mb-1.5 flex flex-wrap items-center gap-1 text-sm text-[var(--admin-on-surface-variant)]">
              <Link href="/studio/learning-paths" className="hover:text-[var(--admin-primary)]">
                Learning paths
              </Link>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden="true" />
              <span className="truncate text-[var(--admin-on-surface)]">{detail.data.title}</span>
            </nav>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-[var(--admin-on-surface)] md:text-2xl">
                {detail.data.title}
              </h1>
              <span className={`${badgeClassName} ${typeCfg.className}`}>{typeCfg.label}</span>
              <span
                className={`${badgeClassName} ${STATUS_CONFIG[detail.data.status] ?? "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]"}`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />
                {STATUS_LABELS[detail.data.status] ?? detail.data.status}
              </span>
            </div>
          </div>
          <LearningPathBuilderLazy path={detail.data} />
        </main>
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <PageGate
          state="denied"
          title="Learning path builder"
          deniedMessage="You do not have permission to edit this path."
        />
      );
    }

    if (error instanceof ServerApiError && error.status === 404) {
      return (
        <PageGate
          state="not_found"
          title="Learning path builder"
          notFoundMessage="This path was not found."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <PageGate
          state="error"
          title="Learning path builder"
          errorMessage={`Failed to load path. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
