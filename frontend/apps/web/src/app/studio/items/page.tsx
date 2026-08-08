import Link from "next/link";
import { PlusCircle } from "lucide-react";
import type { z } from "zod";
import { PageGate } from "../../../components/patterns/PageGate";
import {
  ItemBankEmptyState,
  ItemBankTable,
} from "../../../features/item-registry/components/item-bank-table";
import { primaryButtonClassName } from "../../../features/studio/courses/courses-catalog-shared";
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
        <main className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[var(--admin-on-surface)] md:text-3xl">
                Item Bank
              </h1>
              <p className="mt-0.5 text-sm text-[var(--admin-on-surface-variant)]">
                Author reusable questions for assessments, diagnostics, and practice.
              </p>
            </div>
            <Link href="/studio/items/new" className={primaryButtonClassName}>
              <PlusCircle className="h-4 w-4" aria-hidden="true" />
              Create item
            </Link>
          </div>

          {items.data.length === 0 ? (
            <ItemBankEmptyState />
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
