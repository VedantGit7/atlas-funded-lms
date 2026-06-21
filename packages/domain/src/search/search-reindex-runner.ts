import type { TenantTx } from "@atlas/db";
import { searchRepository } from "./search.repository";
import { getRegisteredSearchSourceAdapters } from "./search-source-registry";
import type { SearchReindexCursor, ServiceCtx } from "./search.types";

const REINDEX_BATCH_SIZE = 50;

export async function runSearchReindex(
  tx: TenantTx,
  ctx: ServiceCtx,
): Promise<{ indexed: number; removed: number }> {
  let indexed = 0;
  let removed = 0;

  const adapters = getRegisteredSearchSourceAdapters();

  for (const adapter of adapters) {
    let cursor: SearchReindexCursor | null = null;
    let continueBatch = true;

    while (continueBatch) {
      const batch = await adapter.iterateReindexBatch(tx, ctx, cursor, REINDEX_BATCH_SIZE);

      for (const projection of batch.projections) {
        if (projection.title.trim().length === 0) {
          await searchRepository.removeIndexEntry(tx, {
            sourceContext: projection.sourceContext,
            sourceType: projection.sourceType,
            sourceId: projection.sourceId,
          });
          removed += 1;
          continue;
        }

        await searchRepository.upsertIndexEntry(tx, projection);
        indexed += 1;
      }

      cursor = batch.nextCursor;
      continueBatch = cursor !== null;
    }
  }

  return { indexed, removed };
}
