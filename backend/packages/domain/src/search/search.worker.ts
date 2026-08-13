import { withTenantTx } from "@atlas/db";
import { z } from "zod";
import {
  communityPostCreatedPayloadSchema,
  coursePublishedPayloadSchema,
  SEARCH_REINDEX_REQUESTED_EVENT,
} from "./search.events";

const moderationDecidedPayloadSchema = z
  .object({
    caseId: z.uuid(),
    contentAction: z.enum(["delete"]).nullable().optional(),
  })
  .loose();

const certificateRevokedPayloadSchema = z
  .object({
    certificateId: z.uuid(),
  })
  .loose();
import { searchRepository } from "./search.repository";
import { runSearchReindex } from "./search-reindex-runner";
import { getSearchAdaptersForEvent, getSearchSourceAdapter } from "./search-source-registry";
import type { ServiceCtx } from "./search.types";

export const SEARCH_WORKER_DESTINATION = "search.index";

const REVOKE_EVENTS = new Set(["certificate.revoked"]);

export async function processSearchSourceEvent(
  tx: Parameters<typeof searchRepository.upsertIndexEntry>[0],
  ctx: ServiceCtx,
  event: { id: string; eventType: string; payload: unknown },
): Promise<void> {
  if (event.eventType === SEARCH_REINDEX_REQUESTED_EVENT) {
    await runSearchReindex(tx, ctx);
    return;
  }

  if (event.eventType === "moderation.decided") {
    await processModerationDecidedEvent(tx, event.payload);
    return;
  }

  if (REVOKE_EVENTS.has(event.eventType)) {
    await processRevokeEvent(tx, event.eventType, event.payload);
    return;
  }

  const adapters = getSearchAdaptersForEvent(event.eventType);
  if (adapters.length === 0) {
    return;
  }

  for (const adapter of adapters) {
    const sourceId = adapter.resolveSourceIdFromEvent(event.eventType, event.payload);
    if (!sourceId) {
      continue;
    }

    const projection = await adapter.buildIndexProjection(tx, ctx, sourceId);
    if (!projection) {
      await searchRepository.removeIndexEntry(tx, {
        sourceContext: adapter.sourceContext,
        sourceType: adapter.sourceType,
        sourceId,
      });
      continue;
    }

    await searchRepository.upsertIndexEntry(tx, projection);
  }
}

async function processRevokeEvent(
  tx: Parameters<typeof searchRepository.upsertIndexEntry>[0],
  eventType: string,
  payload: unknown,
): Promise<void> {
  if (eventType !== "certificate.revoked") {
    return;
  }

  const parsed = certificateRevokedPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return;
  }
  const certificateId = parsed.data.certificateId;

  const adapter = getSearchSourceAdapter("credentialing", "certificate");
  if (!adapter) {
    return;
  }

  await searchRepository.removeIndexEntry(tx, {
    sourceContext: adapter.sourceContext,
    sourceType: adapter.sourceType,
    sourceId: certificateId,
  });
}

async function processModerationDecidedEvent(
  tx: Parameters<typeof searchRepository.upsertIndexEntry>[0],
  payload: unknown,
): Promise<void> {
  const parsed = moderationDecidedPayloadSchema.safeParse(payload);
  if (!parsed.success || parsed.data.contentAction !== "delete") {
    return;
  }

  const caseRows = await tx.$queryRaw<Array<{ target_type: string; target_id: string }>>`
    select target_type, target_id::text
    from moderation_cases
    where id = ${parsed.data.caseId}::uuid
    limit 1
  `;

  const target = caseRows[0];
  if (!target) {
    return;
  }

  if (target.target_type === "post") {
    const adapter = getSearchSourceAdapter("community", "post");
    if (adapter) {
      await searchRepository.removeIndexEntry(tx, {
        sourceContext: adapter.sourceContext,
        sourceType: adapter.sourceType,
        sourceId: target.target_id,
      });
    }
  }
}

export async function handleSearchOutboxEvent(event: {
  id: string;
  eventType: string;
  tenantId: string | null;
  payload: unknown;
  requestId: string;
}): Promise<void> {
  if (event.tenantId == null) {
    throw new Error("Search worker requires tenant-scoped events.");
  }

  const tenantId = event.tenantId;

  await withTenantTx(
    {
      tenantId,
      requestId: event.requestId,
      allowAnonymousTenantRead: true,
    },
    async (tx) => {
      await processSearchSourceEvent(
        tx,
        {
          tenantId,
          actorMembershipId: "00000000-0000-0000-0000-000000000000",
          requestId: event.requestId,
        },
        event,
      );
    },
  );
}

export const searchOutboxHandlers = [
  {
    destinationKey: SEARCH_WORKER_DESTINATION,
    handle: handleSearchOutboxEvent,
  },
];

export const SEARCH_OUTBOX_EVENTS = [
  SEARCH_REINDEX_REQUESTED_EVENT,
  "course.published",
  "community.post.created",
  "certificate.issued",
  "certificate.revoked",
  "moderation.decided",
] as const;

export function validateSearchEventPayload(eventType: string, payload: unknown): void {
  if (eventType === "course.published") {
    coursePublishedPayloadSchema.parse(payload);
  }
  if (eventType === "community.post.created") {
    communityPostCreatedPayloadSchema.parse(payload);
  }
}
