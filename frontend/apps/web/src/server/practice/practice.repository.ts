import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";
import type { PracticeSessionSummary } from "./practice.schemas";

export type PracticeSessionRow = {
  id: string;
  tenant_id: string;
  membership_id: string;
  collection_id: string | null;
  session_type: string;
  status: string;
  started_at: Date;
  completed_at: Date | null;
  summary_json: unknown;
  idempotency_key: string | null;
};

export type PracticeResponseRow = {
  id: string;
  tenant_id: string;
  practice_session_id: string;
  membership_id: string;
  item_id: string;
  response_json: unknown;
  is_correct: boolean | null;
  latency_ms: number | null;
  occurred_at: Date;
  idempotency_key: string;
};

export type SrsStateRow = {
  id: string;
  tenant_id: string;
  membership_id: string;
  item_id: string;
  ease_factor: unknown;
  interval_days: number;
  due_at: Date;
};

export type EligibleSwipeItemRow = {
  id: string;
  item_type_key: string;
  stem_json: unknown;
  explanation_json: unknown;
};

export function parsePracticeSessionSummary(summaryJson: unknown): PracticeSessionSummary {
  if (!summaryJson || typeof summaryJson !== "object" || Array.isArray(summaryJson)) {
    return {
      mode: "due",
      selectedItemIds: [],
      answeredItemIds: [],
    };
  }

  const value = summaryJson as Partial<PracticeSessionSummary>;
  return {
    mode: value.mode === "collection" ? "collection" : "due",
    selectedItemIds: Array.isArray(value.selectedItemIds)
      ? value.selectedItemIds.filter((entry): entry is string => typeof entry === "string")
      : [],
    answeredItemIds: Array.isArray(value.answeredItemIds)
      ? value.answeredItemIds.filter((entry): entry is string => typeof entry === "string")
      : [],
    responseIdempotency: value.responseIdempotency,
    completeIdempotency: value.completeIdempotency,
  };
}

function takePlusOne(limit: number) {
  return Math.min(limit + 1, 51);
}

export const practiceRepository = {
  async findByIdempotencyKey(tx: TenantTx, idempotencyKey: string) {
    return tx.practiceSession.findFirst({
      where: { idempotency_key: idempotencyKey },
      select: {
        id: true,
        tenant_id: true,
        membership_id: true,
        collection_id: true,
        session_type: true,
        status: true,
        started_at: true,
        completed_at: true,
        summary_json: true,
        idempotency_key: true,
      },
    });
  },

  async findById(tx: TenantTx, sessionId: string): Promise<PracticeSessionRow | null> {
    const row = await tx.practiceSession.findFirst({
      where: { id: sessionId },
      select: {
        id: true,
        tenant_id: true,
        membership_id: true,
        collection_id: true,
        session_type: true,
        status: true,
        started_at: true,
        completed_at: true,
        summary_json: true,
        idempotency_key: true,
      },
    });

    return row ?? null;
  },

  async lockById(tx: TenantTx, sessionId: string): Promise<PracticeSessionRow | null> {
    const rows = await tx.$queryRaw<PracticeSessionRow[]>`
      select
        id::text,
        tenant_id::text,
        membership_id::text,
        collection_id::text,
        session_type,
        status,
        started_at,
        completed_at,
        summary_json,
        idempotency_key
      from practice_sessions
      where id = ${sessionId}::uuid
      for update
    `;

    return rows[0] ?? null;
  },

  async insertSession(
    tx: TenantTx,
    data: {
      tenantId: string;
      membershipId: string;
      collectionId: string | null;
      sessionType: string;
      summary: PracticeSessionSummary;
      idempotencyKey: string;
    },
  ) {
    const sessionId = randomUUID();

    await tx.$executeRaw`
      insert into practice_sessions (
        id,
        tenant_id,
        membership_id,
        collection_id,
        session_type,
        status,
        started_at,
        summary_json,
        idempotency_key
      )
      values (
        ${sessionId}::uuid,
        ${data.tenantId}::uuid,
        ${data.membershipId}::uuid,
        ${data.collectionId}::uuid,
        ${data.sessionType},
        'started',
        now(),
        ${JSON.stringify(data.summary)}::jsonb,
        ${data.idempotencyKey}
      )
    `;

    const session = await this.findById(tx, sessionId);
    if (!session) {
      throw new Error("PRACTICE_SESSION_CREATE_FAILED");
    }

    return session;
  },

  async updateSummary(tx: TenantTx, sessionId: string, summary: PracticeSessionSummary) {
    await tx.$executeRaw`
      update practice_sessions
      set summary_json = ${JSON.stringify(summary)}::jsonb
      where id = ${sessionId}::uuid
    `;
  },

  async completeSession(tx: TenantTx, sessionId: string) {
    await tx.$executeRaw`
      update practice_sessions
      set status = 'completed', completed_at = now()
      where id = ${sessionId}::uuid
    `;
  },

  async findResponseByIdempotencyKey(tx: TenantTx, idempotencyKey: string) {
    return tx.practiceResponse.findFirst({
      where: { idempotency_key: idempotencyKey },
      select: {
        id: true,
        practice_session_id: true,
        item_id: true,
        response_json: true,
        is_correct: true,
        occurred_at: true,
        idempotency_key: true,
      },
    });
  },

  async findResponseForSessionItem(tx: TenantTx, sessionId: string, itemId: string) {
    return tx.practiceResponse.findFirst({
      where: {
        practice_session_id: sessionId,
        item_id: itemId,
      },
      select: {
        id: true,
        item_id: true,
        is_correct: true,
        occurred_at: true,
        idempotency_key: true,
      },
    });
  },

  async insertResponse(
    tx: TenantTx,
    data: {
      tenantId: string;
      sessionId: string;
      membershipId: string;
      itemId: string;
      responseJson: Record<string, unknown>;
      isCorrect: boolean;
      latencyMs: number | null;
      idempotencyKey: string;
    },
  ) {
    const responseId = randomUUID();

    await tx.$executeRaw`
      insert into practice_responses (
        id,
        tenant_id,
        practice_session_id,
        membership_id,
        item_id,
        response_json,
        is_correct,
        latency_ms,
        idempotency_key,
        occurred_at
      )
      values (
        ${responseId}::uuid,
        ${data.tenantId}::uuid,
        ${data.sessionId}::uuid,
        ${data.membershipId}::uuid,
        ${data.itemId}::uuid,
        ${JSON.stringify(data.responseJson)}::jsonb,
        ${data.isCorrect},
        ${data.latencyMs},
        ${data.idempotencyKey},
        now()
      )
    `;

    return {
      id: responseId,
      occurredAt: new Date(),
    };
  },

  async listDueStates(
    tx: TenantTx,
    args: {
      membershipId: string;
      limit: number;
      cursor?: string | undefined;
      collectionId?: string | undefined;
    },
  ) {
    const take = takePlusOne(args.limit);

    if (args.collectionId) {
      if (args.cursor) {
        return tx.$queryRaw<
          Array<{
            id: string;
            item_id: string;
            due_at: Date;
          }>
        >`
          select s.id::text, s.item_id::text, s.due_at
          from srs_state s
          inner join item_collection_items ici
            on ici.item_id = s.item_id
            and ici.collection_id = ${args.collectionId}::uuid
          where s.membership_id = ${args.membershipId}::uuid
            and s.due_at <= now()
            and s.id > ${args.cursor}::uuid
          order by s.due_at asc, s.id asc
          limit ${take}
        `;
      }

      return tx.$queryRaw<
        Array<{
          id: string;
          item_id: string;
          due_at: Date;
        }>
      >`
        select s.id::text, s.item_id::text, s.due_at
        from srs_state s
        inner join item_collection_items ici
          on ici.item_id = s.item_id
          and ici.collection_id = ${args.collectionId}::uuid
        where s.membership_id = ${args.membershipId}::uuid
          and s.due_at <= now()
        order by s.due_at asc, s.id asc
        limit ${take}
      `;
    }

    return tx.srsState.findMany({
      where: {
        membership_id: args.membershipId,
        due_at: { lte: new Date() },
        ...(args.cursor ? { id: { gt: args.cursor } } : {}),
      },
      orderBy: [{ due_at: "asc" }, { id: "asc" }],
      take,
      select: {
        id: true,
        item_id: true,
        due_at: true,
      },
    });
  },

  async findSrsState(
    tx: TenantTx,
    membershipId: string,
    itemId: string,
  ): Promise<SrsStateRow | null> {
    const row = await tx.srsState.findFirst({
      where: {
        membership_id: membershipId,
        item_id: itemId,
      },
      select: {
        id: true,
        tenant_id: true,
        membership_id: true,
        item_id: true,
        ease_factor: true,
        interval_days: true,
        due_at: true,
      },
    });

    return row ?? null;
  },

  async upsertSrsState(
    tx: TenantTx,
    data: {
      tenantId: string;
      membershipId: string;
      itemId: string;
      easeFactor: number;
      intervalDays: number;
      dueAt: Date;
    },
  ) {
    const existing = await this.findSrsState(tx, data.membershipId, data.itemId);

    if (existing) {
      await tx.$executeRaw`
        update srs_state
        set
          ease_factor = ${data.easeFactor},
          interval_days = ${data.intervalDays},
          due_at = ${data.dueAt},
          updated_at = now()
        where id = ${existing.id}::uuid
      `;
      return existing.id;
    }

    const srsId = randomUUID();
    await tx.$executeRaw`
      insert into srs_state (
        id,
        tenant_id,
        membership_id,
        item_id,
        ease_factor,
        interval_days,
        due_at,
        updated_at
      )
      values (
        ${srsId}::uuid,
        ${data.tenantId}::uuid,
        ${data.membershipId}::uuid,
        ${data.itemId}::uuid,
        ${data.easeFactor},
        ${data.intervalDays},
        ${data.dueAt},
        now()
      )
    `;

    return srsId;
  },

  async listEligibleSwipeItems(
    tx: TenantTx,
    args: {
      excludeItemIds?: string[];
      limit: number;
      collectionId?: string | undefined;
    },
  ): Promise<EligibleSwipeItemRow[]> {
    const exclude = args.excludeItemIds ?? [];

    if (args.collectionId) {
      const rows = await tx.$queryRaw<EligibleSwipeItemRow[]>`
        select
          i.id::text as id,
          i.item_type_key,
          i.stem_json,
          i.explanation_json
        from item_collection_items ici
        inner join items i on i.id = ici.item_id
        inner join item_collections ic on ic.id = ici.collection_id
        where ici.collection_id = ${args.collectionId}::uuid
          and ic.status = 'PUBLISHED'::"PublishStatus"
          and ic.deleted_at is null
          and ic.collection_type = 'deck'
          and i.deleted_at is null
          and i.status = 'PUBLISHED'::"PublishStatus"
          and i.item_type_key = 'swipe'
          and (${exclude.length} = 0 or i.id <> all(${exclude}::uuid[]))
        order by ici.position asc
        limit ${args.limit}
      `;
      return rows;
    }

    const rows = await tx.$queryRaw<EligibleSwipeItemRow[]>`
      select
        i.id::text as id,
        i.item_type_key,
        i.stem_json,
        i.explanation_json
      from items i
      where i.deleted_at is null
        and i.status = 'PUBLISHED'::"PublishStatus"
        and i.item_type_key = 'swipe'
        and (${exclude.length} = 0 or i.id <> all(${exclude}::uuid[]))
      order by i.updated_at desc, i.id desc
      limit ${args.limit}
    `;

    return rows;
  },

  async listPublishedDeckOptions(tx: TenantTx, limit = 20) {
    const rows = await tx.itemCollection.findMany({
      where: {
        deleted_at: null,
        status: "PUBLISHED",
        collection_type: "deck",
      },
      orderBy: [{ updated_at: "desc" }, { id: "desc" }],
      take: limit,
      select: {
        id: true,
        title: true,
      },
    });

    const counts = await Promise.all(
      rows.map(async (row) => {
        const count = await tx.$queryRaw<Array<{ count: bigint }>>`
          select count(*)::bigint as count
          from item_collection_items ici
          inner join items i on i.id = ici.item_id
          where ici.collection_id = ${row.id}::uuid
            and i.deleted_at is null
            and i.status = 'PUBLISHED'::"PublishStatus"
            and i.item_type_key = 'swipe'
        `;
        return Number(count[0]?.count ?? 0n);
      }),
    );

    return rows
      .map((row, index) => ({
        collectionId: row.id,
        title: row.title,
        itemCount: counts[index] ?? 0,
      }))
      .filter((row) => row.itemCount > 0);
  },

  async findPublishedDeckCollection(tx: TenantTx, collectionId: string) {
    return tx.itemCollection.findFirst({
      where: {
        id: collectionId,
        deleted_at: null,
        status: "PUBLISHED",
        collection_type: "deck",
      },
      select: {
        id: true,
        title: true,
      },
    });
  },

  async listSessionResponses(tx: TenantTx, sessionId: string) {
    return tx.practiceResponse.findMany({
      where: { practice_session_id: sessionId },
      select: {
        item_id: true,
        is_correct: true,
      },
    });
  },
};
