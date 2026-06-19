import type { z } from "zod";
import { PageGate, PageHeader } from "../../../components/patterns/PageGate";
import { ItemCollectionsTable } from "../../../features/item-registry/components/item-collections-table";
import { ServerApiError, serverApi } from "../../../lib/server-api";
import type {
  itemCollectionListResponseSchema,
  itemListResponseSchema,
} from "../../../features/item-registry/item-registry-response-schemas";

type ItemCollectionListResponse = z.infer<typeof itemCollectionListResponseSchema>;
type ItemListResponse = z.infer<typeof itemListResponseSchema>;

export default async function ItemCollectionsPage() {
  try {
    const [collections, items] = await Promise.all([
      serverApi.get<ItemCollectionListResponse>("/api/v1/item-collections"),
      serverApi.get<ItemListResponse>("/api/v1/items"),
    ]);

    return (
      <PageGate state="ready" title="Item Collections">
        <main className="space-y-6">
          <PageHeader
            title="Item Collections / Decks"
            description="Build quiz banks, practice sets, and swipe decks from reusable items."
          />
          <ItemCollectionsTable collections={collections.data} items={items.data} />
        </main>
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <PageGate
          state="denied"
          title="Item Collections"
          deniedMessage="You do not have permission to manage item collections."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <PageGate
          state="error"
          title="Item Collections"
          errorMessage={`Failed to load collections. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
