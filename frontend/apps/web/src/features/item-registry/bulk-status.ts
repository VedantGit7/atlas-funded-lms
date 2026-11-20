"use client";

import { createClientUuid } from "../../lib/api/client";
import {
  bulkDeleteItems,
  bulkSetItemStatus,
  type BulkDeleteItemsBody,
  type BulkItemStatusBody,
} from "./api";
import { withRetry } from "./import/run-import";

/** 20 rounds of BULK_ITEM_STATUS_MAX (500) covers 10,000 questions. */
const MAX_ROUNDS = 20;

export type BulkStatusOutcome = {
  /** Questions whose status changed. */
  updated: number;
  /** Matching questions left alone: another author's, or no longer there. */
  skipped: number;
};

/**
 * Changes the status of the listed questions, or of every question matching a
 * filter. The server changes at most 500 per request and says how many are
 * left, so this repeats the request, each round with its own idempotency key,
 * until none remain.
 */
export async function runBulkStatus(
  body: BulkItemStatusBody,
  onProgress?: (updated: number, remaining: number) => void,
): Promise<BulkStatusOutcome> {
  const runKey = createClientUuid();
  let updated = 0;
  let skipped = 0;
  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    const { data } = await withRetry(() =>
      bulkSetItemStatus(body, `item-bulk-${runKey}-${String(round)}`),
    );
    updated += data.updated;
    skipped = data.skipped;
    onProgress?.(updated, data.remaining);
    if (data.remaining === 0 || data.updated === 0) break;
  }
  return { updated, skipped };
}

export type BulkDeleteOutcome = {
  /** Questions deleted. */
  deleted: number;
  /** Matching questions kept because something uses them. */
  inUse: number;
  /** Matching questions left alone: another author's, or no longer there. */
  skipped: number;
};

/**
 * Deletes the listed questions, or every question matching a filter, 500 per
 * request, repeating until none are left to delete. Questions in use are kept.
 */
export async function runBulkDelete(
  body: BulkDeleteItemsBody,
  onProgress?: (deleted: number, remaining: number) => void,
): Promise<BulkDeleteOutcome> {
  const runKey = createClientUuid();
  let deleted = 0;
  let inUse = 0;
  let skipped = 0;
  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    const { data } = await withRetry(() =>
      bulkDeleteItems(body, `item-bulk-delete-${runKey}-${String(round)}`),
    );
    deleted += data.deleted;
    inUse = data.inUse;
    skipped = data.skipped;
    onProgress?.(deleted, data.remaining);
    if (data.remaining === 0 || data.deleted === 0) break;
  }
  return { deleted, inUse, skipped };
}
