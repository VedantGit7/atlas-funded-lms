import Link from "next/link";
import { notFound } from "next/navigation";
import type { z } from "zod";
import { PageGate } from "../../../../components/patterns/PageGate";
import { ItemEditorForm } from "../../../../features/item-registry/components/item-editor-form";
import { ServerApiError, serverApi } from "../../../../lib/server-api";
import type {
  itemDetailResponseSchema,
  itemTypeListResponseSchema,
  dimensionWeightListResponseSchema,
} from "../../../../features/item-registry/item-registry-response-schemas";
import type { competencyDimensionListResponseSchema } from "@atlas/contracts/competency/competency-config.schemas";

type ItemDetailResponse = z.infer<typeof itemDetailResponseSchema>;
type ItemTypeListResponse = z.infer<typeof itemTypeListResponseSchema>;
type DimensionWeightListResponse = z.infer<typeof dimensionWeightListResponseSchema>;
type CompetencyDimensionListResponse = z.infer<typeof competencyDimensionListResponseSchema>;

export default async function ItemEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isNew = id === "new";

  try {
    const [itemTypes, item, weights, dimensions] = await Promise.all([
      serverApi.get<ItemTypeListResponse>("/api/v1/item-types"),
      isNew
        ? Promise.resolve(null)
        : serverApi.get<ItemDetailResponse>(`/api/v1/items/${id}`).catch((error: unknown) => {
            if (error instanceof ServerApiError && error.status === 404) {
              notFound();
            }
            throw error;
          }),
      isNew
        ? Promise.resolve({ data: [] })
        : serverApi.get<DimensionWeightListResponse>(`/api/v1/items/${id}/dimension-weights`),
      serverApi.get<CompetencyDimensionListResponse>("/api/v1/competency-dimensions"),
    ]);

    return (
      <PageGate state="ready" title={isNew ? "Create item" : "Item Editor"}>
        <main className="space-y-4">
          <div>
            <nav className="mb-1 text-sm text-[var(--admin-on-surface-variant)]">
              <Link
                href="/studio/items"
                className="transition-colors hover:text-[var(--admin-on-surface)]"
              >
                Item Bank
              </Link>
              {" / "}
              <span className="text-[var(--admin-on-surface)]">
                {isNew ? "Create item" : "Edit item"}
              </span>
            </nav>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--admin-on-surface)] md:text-3xl">
              {isNew ? "Create item" : "Edit item"}
            </h1>
            <p className="mt-0.5 text-sm text-[var(--admin-on-surface-variant)]">
              Author a reusable question for assessments and practice sets.
            </p>
          </div>

          <ItemEditorForm
            itemId={isNew ? null : id}
            item={item?.data ?? null}
            itemTypes={itemTypes.data}
            dimensionWeights={weights.data}
            competencyDimensions={dimensions.data}
          />
        </main>
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <PageGate
          state="denied"
          title="Item Editor"
          deniedMessage="You do not have permission to edit items."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <PageGate
          state="error"
          title="Item Editor"
          errorMessage={`Failed to load item. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
