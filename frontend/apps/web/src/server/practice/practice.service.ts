// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

import type { TenantTx } from "@atlas/db";
import { outbox } from "@atlas/events";
import { decodeExplanationJson } from "../item-registry/item-registry.repository";
import {
  duplicatePracticeResponse,
  invalidPracticeItem,
  noEligiblePracticeItems,
  practiceCollectionNotFound,
  practiceIncompleteSession,
  practiceSessionAlreadyCompleted,
  practiceSessionNotFound,
  practiceSessionNotStarted,
} from "./practice.errors";
import {
  parsePracticeSessionSummary,
  practiceRepository,
  type EligibleSwipeItemRow,
} from "./practice.repository";
import type {
  PracticeSessionSummary,
  StartPracticeSessionInput,
  SubmitPracticeResponseInput,
} from "./practice.schemas";
import { scheduleSrsUpdate } from "./srs.service";
import {
  feedbackLabelForAction,
  isSwipeItemType,
  scoreSwipeResponse,
} from "./swipe-scoring.service";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

const DEFAULT_MAX_ITEMS = 10;

function toSafeCard(item: EligibleSwipeItemRow) {
  return {
    itemId: item.id,
    itemTypeKey: "swipe" as const,
    rendererKey: "swipe" as const,
    contentJson:
      item.stem_json && typeof item.stem_json === "object" && !Array.isArray(item.stem_json)
        ? (item.stem_json as Record<string, unknown>)
        : {},
  };
}

function nextUnansweredCard(
  summary: PracticeSessionSummary,
  itemsById: Map<string, EligibleSwipeItemRow>,
) {
  const nextItemId = summary.selectedItemIds.find(
    (itemId) => !summary.answeredItemIds.includes(itemId),
  );

  if (!nextItemId) {
    return null;
  }

  const item = itemsById.get(nextItemId);
  return item ? toSafeCard(item) : null;
}

async function loadItemsByIds(tx: TenantTx, itemIds: string[]) {
  const map = new Map<string, EligibleSwipeItemRow>();
  for (const itemId of itemIds) {
    const rows = await tx.$queryRaw<EligibleSwipeItemRow[]>`
      select
        i.id::text as id,
        i.item_type_key,
        i.stem_json,
        i.explanation_json
      from items i
      where i.id = ${itemId}::uuid
        and i.deleted_at is null
        and i.status = 'PUBLISHED'::"PublishStatus"
        and i.item_type_key = 'swipe'
      limit 1
    `;
    const row = rows[0];
    if (row) {
      map.set(itemId, row);
    }
  }

  return map;
}

async function selectSessionItemIds(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: StartPracticeSessionInput,
  maxItems: number,
): Promise<{ itemIds: string[]; collectionId: string | null }> {
  const selected: string[] = [];

  if (input.mode === "due") {
    const dueRows = await practiceRepository.listDueStates(tx, {
      membershipId: ctx.actorMembershipId,
      limit: maxItems,
    });

    for (const row of dueRows.slice(0, maxItems)) {
      selected.push(row.item_id);
    }

    if (selected.length < maxItems) {
      const unseen = await practiceRepository.listEligibleSwipeItems(tx, {
        excludeItemIds: selected,
        limit: maxItems - selected.length,
      });

      for (const item of unseen) {
        selected.push(item.id);
      }
    }

    return { itemIds: selected, collectionId: null };
  }

  const collectionId = input.collectionId;
  if (!collectionId) {
    throw practiceCollectionNotFound();
  }

  const collection = await practiceRepository.findPublishedDeckCollection(tx, collectionId);
  if (!collection) {
    throw practiceCollectionNotFound();
  }

  const collectionItems = await practiceRepository.listEligibleSwipeItems(tx, {
    collectionId,
    limit: maxItems,
  });

  return {
    itemIds: collectionItems.map((item) => item.id),
    collectionId: collection.id,
  };
}

function buildSessionProjection(session: {
  id: string;
  status: string;
  collection_id: string | null;
  started_at: Date;
  summary_json: unknown;
}) {
  const summary = parsePracticeSessionSummary(session.summary_json);

  return {
    id: session.id,
    status: session.status === "completed" ? ("completed" as const) : ("started" as const),
    mode: summary.mode,
    collectionId: session.collection_id,
    totalItems: summary.selectedItemIds.length,
    answeredCount: summary.answeredItemIds.length,
    startedAt: session.started_at.toISOString(),
  };
}

export async function getDueQueue(
  tx: TenantTx,
  ctx: ServiceCtx,
  query: { cursor?: string | undefined; limit: number; collectionId?: string | undefined },
) {
  const rows = await practiceRepository.listDueStates(tx, {
    membershipId: ctx.actorMembershipId,
    limit: query.limit,
    cursor: query.cursor,
    collectionId: query.collectionId,
  });

  const pageRows = rows.slice(0, query.limit);
  const nextCursor = rows.length > query.limit ? (pageRows.at(-1)?.id ?? null) : null;

  const items = [];
  for (const row of pageRows) {
    const itemRows = await tx.$queryRaw<EligibleSwipeItemRow[]>`
      select
        i.id::text as id,
        i.item_type_key,
        i.stem_json,
        i.explanation_json
      from items i
      where i.id = ${row.item_id}::uuid
        and i.deleted_at is null
        and i.status = 'PUBLISHED'::"PublishStatus"
        and i.item_type_key = 'swipe'
      limit 1
    `;

    const item = itemRows[0];
    if (!item || !isSwipeItemType(item.item_type_key)) {
      continue;
    }

    items.push({
      itemId: row.item_id,
      dueAt: row.due_at.toISOString(),
      card: toSafeCard(item),
    });
  }

  const availableDecks = await practiceRepository.listPublishedDeckOptions(tx);

  return {
    data: {
      items,
      nextCursor,
      availableDecks,
    },
  };
}

export async function startPracticeSession(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: StartPracticeSessionInput,
  idempotencyKey: string,
) {
  const existing = await practiceRepository.findByIdempotencyKey(tx, idempotencyKey);
  if (existing) {
    const summary = parsePracticeSessionSummary(existing.summary_json);
    const itemsById = await loadItemsByIds(tx, summary.selectedItemIds);

    return {
      data: {
        session: buildSessionProjection(existing),
        card: nextUnansweredCard(summary, itemsById),
      },
    };
  }

  const maxItems = input.maxItems ?? DEFAULT_MAX_ITEMS;
  const selection = await selectSessionItemIds(tx, ctx, input, maxItems);

  if (selection.itemIds.length === 0) {
    throw noEligiblePracticeItems();
  }

  const summary: PracticeSessionSummary = {
    mode: input.mode,
    selectedItemIds: selection.itemIds,
    answeredItemIds: [],
  };

  const session = await practiceRepository.insertSession(tx, {
    tenantId: ctx.tenantId,
    membershipId: ctx.actorMembershipId,
    collectionId: selection.collectionId,
    sessionType: "swipe",
    summary,
    idempotencyKey,
  });

  const itemsById = await loadItemsByIds(tx, summary.selectedItemIds);

  return {
    data: {
      session: buildSessionProjection(session),
      card: nextUnansweredCard(summary, itemsById),
    },
  };
}

export async function submitPracticeResponse(
  tx: TenantTx,
  ctx: ServiceCtx,
  sessionId: string,
  input: SubmitPracticeResponseInput,
  idempotencyKey: string,
) {
  const existingByKey = await practiceRepository.findResponseByIdempotencyKey(tx, idempotencyKey);
  if (existingByKey) {
    const session = await practiceRepository.findById(tx, existingByKey.practice_session_id);
    if (!session) {
      throw practiceSessionNotFound();
    }

    const summary = parsePracticeSessionSummary(session.summary_json);
    const replay = summary.responseIdempotency?.[idempotencyKey];
    const itemsById = await loadItemsByIds(tx, summary.selectedItemIds);

    return {
      data: {
        response: {
          itemId: existingByKey.item_id,
          isCorrect: existingByKey.is_correct ?? false,
          feedbackLabel: feedbackLabelForAction(existingByKey.is_correct ?? false),
          occurredAt: replay?.occurredAt ?? existingByKey.occurred_at.toISOString(),
        },
        progress: {
          answeredCount: summary.answeredItemIds.length,
          totalItems: summary.selectedItemIds.length,
        },
        nextCard: nextUnansweredCard(summary, itemsById),
      },
    };
  }

  const session = await practiceRepository.lockById(tx, sessionId);
  if (!session || session.tenant_id !== ctx.tenantId) {
    throw practiceSessionNotFound();
  }

  if (session.membership_id !== ctx.actorMembershipId) {
    throw practiceSessionNotFound();
  }

  if (session.status !== "started") {
    throw session.status === "completed"
      ? practiceSessionAlreadyCompleted()
      : practiceSessionNotStarted();
  }

  const summary = parsePracticeSessionSummary(session.summary_json);

  if (!summary.selectedItemIds.includes(input.itemId)) {
    throw invalidPracticeItem();
  }

  const duplicate = await practiceRepository.findResponseForSessionItem(
    tx,
    sessionId,
    input.itemId,
  );
  if (duplicate) {
    throw duplicatePracticeResponse();
  }

  const itemRows = await tx.$queryRaw<EligibleSwipeItemRow[]>`
    select
      i.id::text as id,
      i.item_type_key,
      i.stem_json,
      i.explanation_json
    from items i
    where i.id = ${input.itemId}::uuid
      and i.deleted_at is null
      and i.status = 'PUBLISHED'::"PublishStatus"
      and i.item_type_key = 'swipe'
    limit 1
  `;

  const item = itemRows[0];
  if (!item || !isSwipeItemType(item.item_type_key)) {
    throw invalidPracticeItem();
  }

  const decoded = decodeExplanationJson(item.explanation_json);
  const isCorrect = scoreSwipeResponse({
    itemTypeKey: item.item_type_key,
    answerKeyJson: decoded.answerKeyJson,
    action: input.action,
  });

  const inserted = await practiceRepository.insertResponse(tx, {
    tenantId: ctx.tenantId,
    sessionId,
    membershipId: ctx.actorMembershipId,
    itemId: input.itemId,
    responseJson: { action: input.action },
    isCorrect,
    latencyMs: input.latencyMs ?? null,
    idempotencyKey,
  });

  const previousSrs = await practiceRepository.findSrsState(
    tx,
    ctx.actorMembershipId,
    input.itemId,
  );
  const nextSrs = scheduleSrsUpdate({
    previous: previousSrs
      ? {
          easeFactor: Number(previousSrs.ease_factor),
          intervalDays: previousSrs.interval_days,
        }
      : null,
    isCorrect,
  });

  await practiceRepository.upsertSrsState(tx, {
    tenantId: ctx.tenantId,
    membershipId: ctx.actorMembershipId,
    itemId: input.itemId,
    easeFactor: nextSrs.easeFactor,
    intervalDays: nextSrs.intervalDays,
    dueAt: nextSrs.dueAt,
  });

  const occurredAt = inserted.occurredAt.toISOString();
  const nextSummary: PracticeSessionSummary = {
    ...summary,
    answeredItemIds: [...summary.answeredItemIds, input.itemId],
    responseIdempotency: {
      ...(summary.responseIdempotency ?? {}),
      [idempotencyKey]: {
        itemId: input.itemId,
        isCorrect,
        action: input.action,
        occurredAt,
      },
    },
  };

  await practiceRepository.updateSummary(tx, sessionId, nextSummary);

  const itemsById = await loadItemsByIds(tx, nextSummary.selectedItemIds);

  return {
    data: {
      response: {
        itemId: input.itemId,
        isCorrect,
        feedbackLabel: feedbackLabelForAction(isCorrect),
        occurredAt,
      },
      progress: {
        answeredCount: nextSummary.answeredItemIds.length,
        totalItems: nextSummary.selectedItemIds.length,
      },
      nextCard: nextUnansweredCard(nextSummary, itemsById),
    },
  };
}

export async function completePracticeSession(
  tx: TenantTx,
  ctx: ServiceCtx,
  sessionId: string,
  idempotencyKey: string,
) {
  const session = await practiceRepository.lockById(tx, sessionId);
  if (!session || session.tenant_id !== ctx.tenantId) {
    throw practiceSessionNotFound();
  }

  if (session.membership_id !== ctx.actorMembershipId) {
    throw practiceSessionNotFound();
  }

  const summary = parsePracticeSessionSummary(session.summary_json);
  const replay = summary.completeIdempotency?.[idempotencyKey];

  if (session.status === "completed") {
    const responses = await practiceRepository.listSessionResponses(tx, sessionId);
    const correctCount = responses.filter((row) => row.is_correct === true).length;

    return {
      data: {
        sessionId,
        status: "completed" as const,
        completedAt:
          session.completed_at?.toISOString() ?? replay?.completedAt ?? new Date().toISOString(),
        summary: {
          totalItems: summary.selectedItemIds.length,
          answeredCount: summary.answeredItemIds.length,
          correctCount,
          practiceRecorded: true as const,
        },
      },
    };
  }

  if (session.status !== "started") {
    throw practiceSessionNotStarted();
  }

  if (summary.answeredItemIds.length !== summary.selectedItemIds.length) {
    throw practiceIncompleteSession();
  }

  const responses = await practiceRepository.listSessionResponses(tx, sessionId);
  const correctCount = responses.filter((row) => row.is_correct === true).length;
  const completedAt = new Date().toISOString();

  const nextSummary: PracticeSessionSummary = {
    ...summary,
    completeIdempotency: {
      ...(summary.completeIdempotency ?? {}),
      [idempotencyKey]: {
        completedAt,
        answeredCount: summary.answeredItemIds.length,
        correctCount,
      },
    },
  };

  await practiceRepository.updateSummary(tx, sessionId, nextSummary);
  await practiceRepository.completeSession(tx, sessionId);

  await outbox.publish(tx, {
    ctx: {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      requestId: ctx.requestId,
    },
    eventType: "practice.session_completed",
    aggregateType: "practice_session",
    aggregateId: sessionId,
    payload: {
      practiceSessionId: sessionId,
      membershipId: ctx.actorMembershipId,
      collectionId: session.collection_id,
      sessionType: session.session_type,
    },
    idempotencyKey: `practice.session_completed:${sessionId}`,
  });

  return {
    data: {
      sessionId,
      status: "completed" as const,
      completedAt,
      summary: {
        totalItems: summary.selectedItemIds.length,
        answeredCount: summary.answeredItemIds.length,
        correctCount,
        practiceRecorded: true as const,
      },
    },
  };
}
