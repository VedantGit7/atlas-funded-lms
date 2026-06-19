import { notFound } from "next/navigation";
import type { z } from "zod";
import { PageGate, PageHeader } from "../../../../components/patterns/PageGate";
import { ItemEditorForm } from "../../../../features/item-registry/components/item-editor-form";
import { ServerApiError, serverApi } from "../../../../lib/server-api";
import type {
  itemDetailResponseSchema,
  itemTypeListResponseSchema,
  dimensionWeightListResponseSchema,
} from "../../../../features/item-registry/item-registry-response-schemas";

type ItemDetailResponse = z.infer<typeof itemDetailResponseSchema>;
type ItemTypeListResponse = z.infer<typeof itemTypeListResponseSchema>;
type DimensionWeightListResponse = z.infer<typeof dimensionWeightListResponseSchema>;

export default async function ItemEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isNew = id === "new";

  try {
    const [itemTypes, item, weights] = await Promise.all([
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
    ]);

    return (
      <PageGate state="ready" title={isNew ? "Create item" : "Item Editor"}>
        <main className="space-y-6">
          <PageHeader
            title={isNew ? "Create item" : "Item Editor"}
            description="Edit stem, options, answer key, tags, and dimension weights."
          />
          <ItemEditorForm
            itemId={isNew ? null : id}
            item={item?.data ?? null}
            itemTypes={itemTypes.data}
            dimensionWeights={weights.data}
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
