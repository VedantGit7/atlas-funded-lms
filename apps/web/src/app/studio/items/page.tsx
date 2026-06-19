import Link from "next/link";
import type { z } from "zod";
import { PageGate, PageHeader } from "../../../components/patterns/PageGate";
import { ItemBankTable } from "../../../features/item-registry/components/item-bank-table";
import { ServerApiError, serverApi } from "../../../lib/server-api";
import type {
  itemListResponseSchema,
  itemTypeListResponseSchema,
} from "../../../features/item-registry/item-registry-response-schemas";

type ItemListResponse = z.infer<typeof itemListResponseSchema>;
type ItemTypeListResponse = z.infer<typeof itemTypeListResponseSchema>;

export default async function ItemBankPage() {
  try {
    const [items, itemTypes] = await Promise.all([
      serverApi.get<ItemListResponse>("/api/v1/items"),
      serverApi.get<ItemTypeListResponse>("/api/v1/item-types"),
    ]);

    return (
      <PageGate state="ready" title="Item Bank">
        <main className="space-y-6">
          <PageHeader
            title="Item Bank"
            description="Author reusable items for assessments, diagnostics, and practice."
          />
          <div className="flex justify-end">
            <Link href="/studio/items/new">Create item</Link>
          </div>

          {items.data.length === 0 ? (
            <div className="rounded border p-6">
              <h2>No items yet</h2>
              <p>Create your first item using a registered item type.</p>
              <Link href="/studio/items/new" className="mt-4 inline-block">
                Create item
              </Link>
            </div>
          ) : (
            <ItemBankTable items={items.data} itemTypes={itemTypes.data} />
          )}
        </main>
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <PageGate
          state="denied"
          title="Item Bank"
          deniedMessage="You do not have permission to view the item bank."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <PageGate
          state="error"
          title="Item Bank"
          errorMessage={`Failed to load items. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
