import Link from "next/link";
import { FileUp, PlusCircle } from "lucide-react";
import type { z } from "zod";
import { PageGate } from "../../../components/patterns/PageGate";
import {
  ItemBankEmptyState,
  ItemBankTable,
  type ItemBankFilters,
} from "../../../features/item-registry/components/item-bank-table";
import {
  outlineButtonClassName,
  primaryButtonClassName,
} from "../../../features/studio/courses/courses-catalog-shared";
import { ServerApiError, serverApi } from "../../../lib/server-api";
import type {
  itemListResponseSchema,
  itemTypeListResponseSchema,
} from "../../../features/item-registry/item-registry-response-schemas";

type ItemListResponse = z.infer<typeof itemListResponseSchema>;
type ItemTypeListResponse = z.infer<typeof itemTypeListResponseSchema>;

const PAGE_SIZE = 50;
const STATUSES = new Set(["DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SearchParams = {
  q?: string | string[];
  type?: string | string[];
  status?: string | string[];
  batch?: string | string[];
};

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

/** The filters in the address, anything malformed dropped. */
function filtersFrom(params: SearchParams): ItemBankFilters {
  const status = first(params.status).toUpperCase();
  const batch = first(params.batch);
  return {
    q: first(params.q).trim().slice(0, 120),
    itemTypeKey: /^[a-z][a-z0-9_]{0,63}$/.test(first(params.type)) ? first(params.type) : "",
    status: STATUSES.has(status) ? status : "",
    importBatchId: UUID.test(batch) ? batch : "",
  };
}

export default async function ItemBankPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const filters = filtersFrom(await searchParams);
  const query = new URLSearchParams({ limit: String(PAGE_SIZE) });
  if (filters.q) query.set("q", filters.q);
  if (filters.itemTypeKey) query.set("itemTypeKey", filters.itemTypeKey);
  if (filters.status) query.set("status", filters.status);
  if (filters.importBatchId) query.set("importBatchId", filters.importBatchId);
  const filtered = Boolean(
    filters.q || filters.itemTypeKey || filters.status || filters.importBatchId,
  );
  try {
    const [items, itemTypes] = await Promise.all([
      serverApi.get<ItemListResponse>(`/api/v1/items?${query.toString()}`),
      serverApi.get<ItemTypeListResponse>("/api/v1/item-types"),
    ]);

    return (
      <PageGate state="ready" title="Question bank">
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
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Link
                href="/studio/items/import"
                className={`${outlineButtonClassName} inline-flex items-center gap-1.5 px-4 py-2`}
              >
                <FileUp className="h-4 w-4" aria-hidden="true" />
                Import questions
              </Link>
              <Link href="/studio/items/new" className={primaryButtonClassName}>
                <PlusCircle className="h-4 w-4" aria-hidden="true" />
                Create item
              </Link>
            </div>
          </div>

          {items.data.length === 0 && !filtered ? (
            <ItemBankEmptyState />
          ) : (
            <ItemBankTable
              initialPage={items}
              initialFilters={filters}
              itemTypes={itemTypes.data}
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
          title="Question bank"
          deniedMessage="You do not have permission to view the item bank."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <PageGate
          state="error"
          title="Question bank"
          errorMessage={`Failed to load items. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
