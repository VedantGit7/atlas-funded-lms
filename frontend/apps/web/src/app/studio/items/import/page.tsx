import Link from "next/link";
import type { z } from "zod";
import { PageGate } from "../../../../components/patterns/PageGate";
import { ImportHistory } from "../../../../features/item-registry/import/import-history";
import { ItemImportWizard } from "../../../../features/item-registry/import/item-import-wizard";
import { ServerApiError, serverApi } from "../../../../lib/server-api";
import type { itemTypeListResponseSchema } from "../../../../features/item-registry/item-registry-response-schemas";

type ItemTypeListResponse = z.infer<typeof itemTypeListResponseSchema>;

const TITLE = "Import questions";

export default async function ItemImportPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string | string[] }>;
}) {
  const { type } = await searchParams;
  try {
    const itemTypes = await serverApi.get<ItemTypeListResponse>("/api/v1/item-types");

    return (
      <PageGate state="ready" title={TITLE}>
        <main className="mx-auto max-w-5xl space-y-4">
          <div>
            <nav className="mb-1 text-sm text-[var(--admin-on-surface-variant)]">
              <Link
                href="/studio/items"
                className="transition-colors hover:text-[var(--admin-on-surface)]"
              >
                Item Bank
              </Link>
              {" / "}
              <span className="text-[var(--admin-on-surface)]">{TITLE}</span>
            </nav>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--admin-on-surface)] md:text-3xl">
              {TITLE}
            </h1>
            <p className="mt-0.5 max-w-2xl text-sm text-[var(--admin-on-surface-variant)]">
              Add many questions of one type at once from an Excel template. You review every row
              before anything is added. Imported questions start as Drafts; publish them when you
              are ready.
            </p>
          </div>
          <ItemImportWizard
            itemTypes={itemTypes.data}
            initialType={typeof type === "string" ? type : null}
          />
          <ImportHistory />
        </main>
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <PageGate
          state="denied"
          title={TITLE}
          deniedMessage="You do not have permission to import questions."
        />
      );
    }
    if (error instanceof ServerApiError) {
      return (
        <PageGate
          state="error"
          title={TITLE}
          errorMessage={`Failed to load question types. Request ID: ${error.requestId}`}
        />
      );
    }
    throw error;
  }
}
