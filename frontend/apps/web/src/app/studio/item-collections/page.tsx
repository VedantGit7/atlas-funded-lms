import type { z } from "zod";
import { PageGate } from "../../../components/patterns/PageGate";
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
        <main className="flex min-h-[calc(100dvh-10rem)] flex-col space-y-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--admin-on-surface)] md:text-3xl">
              Item Collections
            </h1>
            <p className="mt-0.5 max-w-2xl text-sm text-[var(--admin-on-surface-variant)]">
              Build quiz banks, practice sets, and swipe decks from reusable items.
            </p>
          </div>
          <div className="min-h-0 flex-1">
            <ItemCollectionsTable collections={collections.data} items={items.data} />
          </div>
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
