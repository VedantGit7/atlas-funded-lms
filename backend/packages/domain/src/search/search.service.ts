import { outbox } from "@atlas/events";
import type { TenantTx } from "@atlas/db";
import { resolveAuthorizedSearchResult } from "./search-access-resolver";
import { searchListResponseSchema, searchQuerySchema, SEARCH_SOURCE_TYPES } from "./search.dto";
import {
  SEARCH_REINDEX_REQUESTED_EVENT,
  searchReindexRequestedPayloadSchema,
} from "./search.events";
import { invalidSearchQuery, unknownSearchSourceType } from "./search.errors";
import { searchRepository } from "./search.repository";
import type { SearchIndexRow, ServiceCtx } from "./search.types";

export async function querySearch(tx: TenantTx, ctx: ServiceCtx, rawQuery: unknown) {
  const query = searchQuerySchema.parse(rawQuery);

  if (query.type && !SEARCH_SOURCE_TYPES.includes(query.type)) {
    throw unknownSearchSourceType(query.type);
  }

  if (query.q && query.q.length > 0 && query.q.length < 2) {
    throw invalidSearchQuery("Query must be at least 2 characters.");
  }

  if (!query.q) {
    return searchListResponseSchema.parse({
      data: {
        items: [],
        pageInfo: {
          nextCursor: null,
          hasNextPage: false,
        },
      },
    });
  }

  const items = [];
  let scanCursor = query.cursor ?? null;
  let lastIncludedId: string | null = null;
  let hasNextPage = false;

  while (items.length < query.limit) {
    const rows = await searchRepository.queryIndexEntries(tx, {
      q: query.q,
      sourceType: query.type ?? null,
      cursor: scanCursor,
      limit: query.limit,
    });

    if (rows.length === 0) {
      break;
    }

    for (const entry of rows.slice(0, query.limit)) {
      const resolved = await resolveAuthorizedSearchResult({
        tx,
        ctx,
        entry,
        q: query.q,
      });

      if (!resolved) {
        continue;
      }

      items.push(resolved);
      lastIncludedId = entry.id;

      if (items.length >= query.limit) {
        hasNextPage = rows.length > query.limit || rows.length === query.limit;
        break;
      }
    }

    if (items.length >= query.limit || rows.length <= query.limit) {
      if (rows.length > query.limit) {
        hasNextPage = true;
      }
      break;
    }

    scanCursor = rows.at(-1)?.id ?? null;
    if (scanCursor === null) {
      break;
    }
  }

  return searchListResponseSchema.parse({
    data: {
      items,
      pageInfo: {
        nextCursor: hasNextPage ? lastIncludedId : null,
        hasNextPage,
      },
    },
  });
}

export async function requestSearchReindex(tx: TenantTx, ctx: ServiceCtx) {
  if (!ctx.idempotencyKey) {
    throw invalidSearchQuery("Idempotency-Key header is required.");
  }

  const payload = searchReindexRequestedPayloadSchema.parse({
    requestedAt: new Date().toISOString(),
    requestedByMembershipId: ctx.actorMembershipId,
  });

  await outbox.publish(tx, {
    ctx: {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      requestId: ctx.requestId,
    },
    eventType: SEARCH_REINDEX_REQUESTED_EVENT,
    aggregateType: "search_index",
    aggregateId: ctx.tenantId,
    payload,
    idempotencyKey: ctx.idempotencyKey,
  });

  return {
    data: {
      queued: true as const,
      eventType: SEARCH_REINDEX_REQUESTED_EVENT,
    },
  };
}

export async function upsertSearchIndexEntry(
  tx: TenantTx,
  projection: Parameters<typeof searchRepository.upsertIndexEntry>[1],
): Promise<SearchIndexRow> {
  return searchRepository.upsertIndexEntry(tx, projection);
}
