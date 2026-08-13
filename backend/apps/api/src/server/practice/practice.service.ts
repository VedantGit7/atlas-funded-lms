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
  practiceSessionExpired,
  practiceSessionNotFound,
  practiceSessionNotStarted,
} from "./practice.errors";
import {
  parsePracticeSessionSummary,
  practiceRepository,
  type EligibleSwipeItemRow,
} from "./practice.repository";
import type {
  PracticeEngine,
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
import { buildMatchOptions, isMatchItemType, scoreMatchResponse } from "./match-scoring.service";
import { scoreAttempt } from "../assessments/scoring.service";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

async function resolvePracticeCourseId(
  tx: TenantTx,
  collectionId: string | null,
): Promise<string | null> {
  if (!collectionId) {
    return null;
  }

  const rows = await tx.$queryRaw<Array<{ metadata_json: unknown }>>`
    select metadata_json
    from item_collections
    where id = ${collectionId}::uuid
    limit 1
  `;
  const metadata = rows[0]?.metadata_json;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const courseId = (metadata as Record<string, unknown>)["courseId"];
  return typeof courseId === "string" && courseId.length > 0 ? courseId : null;
}

const DEFAULT_MAX_ITEMS = 10;

/** Narrowed view of the validated submit-response union. */
type SubmittedPracticeResponse =
  | { itemId: string; action: "known" | "unknown"; latencyMs?: number }
  | { itemId: string; pairs: Record<string, string>; latencyMs?: number }
  | { itemId: string; selectedOptionId: string; latencyMs?: number };

/**
 * Pulls only the author-written explanation string out of an answer key. The
 * rest of the key (the graded answer) never leaves the server.
 */
function readExplanationText(answerKeyJson: unknown): string | null {
  if (answerKeyJson && typeof answerKeyJson === "object" && !Array.isArray(answerKeyJson)) {
    const value = (answerKeyJson as Record<string, unknown>)["explanation"];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

/** The item types each engine draws from. */
export function itemTypeKeysForEngine(engine: PracticeEngine): string[] {
  if (engine === "match") return ["matching"];
  if (engine === "learn" || engine === "test") return ["mcq_single", "true_false"];
  return ["swipe"];
}

/** Engines that grade on the server and submit a choice. */
export function isChoiceEngine(engine: PracticeEngine): boolean {
  return engine === "learn" || engine === "test";
}

export const TEST_SECONDS_PER_ITEM = 45;

/** Timed engines get a server-set deadline; everything else is untimed. */
export function deadlineForEngine(
  engine: PracticeEngine,
  itemCount: number,
  now: Date,
): string | null {
  if (engine !== "test" || itemCount === 0) return null;
  return new Date(now.getTime() + itemCount * TEST_SECONDS_PER_ITEM * 1000).toISOString();
}

export function isExpired(expiresAt: string | undefined, now: Date): boolean {
  if (!expiresAt) return false;
  const deadline = Date.parse(expiresAt);
  return Number.isFinite(deadline) && now.getTime() > deadline;
}

export type ChoiceOptionRow = {
  id: string;
  label: string;
  isCorrect: boolean | null;
  position: number;
};

const TRUE_FALSE_OPTIONS: ChoiceOptionRow[] = [
  { id: "true", label: "True", isCorrect: null, position: 0 },
  { id: "false", label: "False", isCorrect: null, position: 1 },
];

/** true_false items store no options rows, so present a fixed pair. */
export function choiceOptionsForItem(
  itemTypeKey: string,
  stored: ChoiceOptionRow[] | undefined,
): ChoiceOptionRow[] {
  if (itemTypeKey === "true_false") return TRUE_FALSE_OPTIONS;
  return stored ?? [];
}

/** Maps a learner's chosen option id onto the answer shape the grader expects. */
export function answerJsonForChoice(
  itemTypeKey: string,
  selectedOptionId: string,
): Record<string, unknown> {
  if (itemTypeKey === "true_false") return { value: selectedOptionId === "true" };
  return { selectedOptionId };
}

function toSafeCard(
  item: EligibleSwipeItemRow,
  engine: PracticeEngine,
  options?: ChoiceOptionRow[],
) {
  const contentJson =
    item.stem_json && typeof item.stem_json === "object" && !Array.isArray(item.stem_json)
      ? (item.stem_json as Record<string, unknown>)
      : {};

  if (isChoiceEngine(engine)) {
    const choices = choiceOptionsForItem(item.item_type_key, options);
    const itemTypeKey =
      item.item_type_key === "true_false" ? ("true_false" as const) : ("mcq_single" as const);
    return {
      itemId: item.id,
      itemTypeKey,
      rendererKey: "choice" as const,
      contentJson,
      // isCorrect is intentionally dropped: grading happens on the server.
      options: choices.map((option) => ({ id: option.id, label: option.label })),
    };
  }

  if (engine === "match") {
    const decoded = decodeExplanationJson(item.explanation_json);
    const options = buildMatchOptions(decoded.answerKeyJson);
    return {
      itemId: item.id,
      itemTypeKey: "matching" as const,
      rendererKey: "matching" as const,
      contentJson,
      leftItems: options.leftItems,
      rightItems: options.rightItems,
    };
  }

  if (engine === "flashcards") {
    const decoded = decodeExplanationJson(item.explanation_json);
    return {
      itemId: item.id,
      itemTypeKey: "swipe" as const,
      rendererKey: "flashcard" as const,
      contentJson,
      explanation: readExplanationText(decoded.answerKeyJson),
    };
  }

  return {
    itemId: item.id,
    itemTypeKey: "swipe" as const,
    rendererKey: "swipe" as const,
    contentJson,
  };
}

function nextUnansweredCard(
  summary: PracticeSessionSummary,
  itemsById: Map<string, EligibleSwipeItemRow>,
  optionsById?: Map<string, ChoiceOptionRow[]>,
) {
  const nextItemId = summary.selectedItemIds.find(
    (itemId) => !summary.answeredItemIds.includes(itemId),
  );

  if (!nextItemId) {
    return null;
  }

  const item = itemsById.get(nextItemId);
  return item ? toSafeCard(item, summary.engine, optionsById?.get(item.id)) : null;
}

async function loadItemsByIds(tx: TenantTx, itemIds: string[], itemTypeKeys: string[]) {
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
        and i.item_type_key = any(${itemTypeKeys}::text[])
      limit 1
    `;
    const row = rows[0];
    if (row) {
      map.set(itemId, row);
    }
  }

  return map;
}

/** Items plus (for choice engines) their options, ready for card building. */
async function loadCardContext(tx: TenantTx, itemIds: string[], engine: PracticeEngine) {
  const itemsById = await loadItemsByIds(tx, itemIds, itemTypeKeysForEngine(engine));
  const optionsById = isChoiceEngine(engine)
    ? await practiceRepository.listItemOptions(tx, [...itemsById.keys()])
    : new Map<string, ChoiceOptionRow[]>();
  return { itemsById, optionsById };
}

async function selectSessionItemIds(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: StartPracticeSessionInput,
  maxItems: number,
): Promise<{ itemIds: string[]; collectionId: string | null }> {
  const selected: string[] = [];
  const itemTypeKeys = itemTypeKeysForEngine(input.engine);

  if (input.mode === "due") {
    const dueRows = await practiceRepository.listDueStates(tx, {
      membershipId: ctx.actorMembershipId,
      limit: maxItems,
      itemTypeKeys,
    });

    for (const row of dueRows.slice(0, maxItems)) {
      selected.push(row.item_id);
    }

    if (selected.length < maxItems) {
      const unseen = await practiceRepository.listEligibleSwipeItems(tx, {
        itemTypeKeys,
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
    itemTypeKeys,
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
    engine: summary.engine,
    collectionId: session.collection_id,
    totalItems: summary.selectedItemIds.length,
    answeredCount: summary.answeredItemIds.length,
    startedAt: session.started_at.toISOString(),
    expiresAt: summary.expiresAt ?? null,
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
    // The queue preview and `dueTotal` both report swipe cards.
    itemTypeKeys: ["swipe"],
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
      // The due queue is a preview list; engine is chosen when a session starts.
      card: toSafeCard(item, "swipe"),
    });
  }

  const [availableDecks, dueTotal] = await Promise.all([
    practiceRepository.listPublishedDeckOptions(tx, ctx.actorMembershipId),
    practiceRepository.countDueTotal(tx, ctx.actorMembershipId),
  ]);

  return {
    data: {
      items,
      nextCursor,
      availableDecks,
      dueTotal,
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
    const { itemsById, optionsById } = await loadCardContext(
      tx,
      summary.selectedItemIds,
      summary.engine,
    );

    return {
      data: {
        session: buildSessionProjection(existing),
        card: nextUnansweredCard(summary, itemsById, optionsById),
      },
    };
  }

  const maxItems = input.maxItems ?? DEFAULT_MAX_ITEMS;
  const selection = await selectSessionItemIds(tx, ctx, input, maxItems);

  if (selection.itemIds.length === 0) {
    throw noEligiblePracticeItems();
  }

  const deadline = deadlineForEngine(input.engine, selection.itemIds.length, new Date());
  const summary: PracticeSessionSummary = {
    mode: input.mode,
    engine: input.engine,
    ...(deadline ? { expiresAt: deadline } : {}),
    selectedItemIds: selection.itemIds,
    answeredItemIds: [],
  };

  const session = await practiceRepository.insertSession(tx, {
    tenantId: ctx.tenantId,
    membershipId: ctx.actorMembershipId,
    collectionId: selection.collectionId,
    sessionType: input.engine,
    summary,
    idempotencyKey,
  });

  const { itemsById, optionsById } = await loadCardContext(
    tx,
    summary.selectedItemIds,
    summary.engine,
  );

  return {
    data: {
      session: buildSessionProjection(session),
      card: nextUnansweredCard(summary, itemsById, optionsById),
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
    const { itemsById, optionsById } = await loadCardContext(
      tx,
      summary.selectedItemIds,
      summary.engine,
    );

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
        nextCard: nextUnansweredCard(summary, itemsById, optionsById),
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

  const engine = summary.engine;
  if (isExpired(summary.expiresAt, new Date())) {
    throw practiceSessionExpired();
  }
  const engineItemTypeKeys = itemTypeKeysForEngine(engine);

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
      and i.item_type_key = any(${engineItemTypeKeys}::text[])
    limit 1
  `;

  const item = itemRows[0];
  if (!item) {
    throw invalidPracticeItem();
  }

  // The zod union already validated one of these two shapes; the `.loose()`
  // guards in the schema widen the inferred type, so narrow through it explicitly.
  const body = input as unknown as SubmittedPracticeResponse;
  const submittedPairs = "pairs" in body ? body.pairs : undefined;
  const submittedAction = "action" in body ? body.action : undefined;
  const submittedOptionId = "selectedOptionId" in body ? body.selectedOptionId : undefined;

  // The response shape must match the engine the session was started with.
  if (engine === "match") {
    if (!isMatchItemType(item.item_type_key) || !submittedPairs) {
      throw invalidPracticeItem();
    }
  } else if (isChoiceEngine(engine)) {
    if (!submittedOptionId) {
      throw invalidPracticeItem();
    }
  } else if (!isSwipeItemType(item.item_type_key) || !submittedAction) {
    throw invalidPracticeItem();
  }

  const decoded = decodeExplanationJson(item.explanation_json);

  let isCorrect: boolean;
  if (submittedOptionId) {
    // Reuse the assessment grader so choice items score identically everywhere.
    const storedOptions = await practiceRepository.listItemOptions(tx, [item.id]);
    const choices = choiceOptionsForItem(item.item_type_key, storedOptions.get(item.id));
    const scored = scoreAttempt({
      items: [
        {
          assessmentItemId: item.id,
          itemId: item.id,
          itemTypeKey: item.item_type_key,
          points: 1,
          answerKeyJson: decoded.answerKeyJson,
          options: choices.map((option) => ({
            id: option.id,
            isCorrect: option.isCorrect,
            position: option.position,
          })),
        },
      ],
      answers: new Map([[item.id, answerJsonForChoice(item.item_type_key, submittedOptionId)]]),
    });
    isCorrect = scored.itemResults[0]?.isCorrect === true;
  } else if (submittedPairs) {
    isCorrect = scoreMatchResponse({
      itemTypeKey: item.item_type_key,
      answerKeyJson: decoded.answerKeyJson,
      pairs: submittedPairs,
    });
  } else {
    isCorrect = scoreSwipeResponse({
      itemTypeKey: item.item_type_key,
      answerKeyJson: decoded.answerKeyJson,
      action: submittedAction ?? "unknown",
    });
  }

  const inserted = await practiceRepository.insertResponse(tx, {
    tenantId: ctx.tenantId,
    sessionId,
    membershipId: ctx.actorMembershipId,
    itemId: input.itemId,
    responseJson: submittedOptionId
      ? { selectedOptionId: submittedOptionId }
      : submittedPairs
        ? { pairs: submittedPairs }
        : { action: submittedAction },
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
        ...(submittedAction ? { action: submittedAction } : {}),
        occurredAt,
      },
    },
  };

  await practiceRepository.updateSummary(tx, sessionId, nextSummary);

  const { itemsById, optionsById } = await loadCardContext(
    tx,
    nextSummary.selectedItemIds,
    nextSummary.engine,
  );

  return {
    data: {
      response: {
        itemId: input.itemId,
        // A timed test must not leak the answer key over the wire.
        isCorrect: engine === "test" ? null : isCorrect,
        feedbackLabel: engine === "test" ? "Answer recorded" : feedbackLabelForAction(isCorrect),
        explanation: engine === "test" ? null : readExplanationText(decoded.answerKeyJson),
        occurredAt,
      },
      progress: {
        answeredCount: nextSummary.answeredItemIds.length,
        totalItems: nextSummary.selectedItemIds.length,
      },
      nextCard: nextUnansweredCard(nextSummary, itemsById, optionsById),
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
      courseId: await resolvePracticeCourseId(tx, session.collection_id),
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
