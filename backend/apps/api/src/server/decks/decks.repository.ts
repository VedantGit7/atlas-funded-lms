import { createUuidV7 } from "@atlas/core/id/uuid-v7";
import { outbox } from "@atlas/events";

type Tx = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<unknown>;
};

export type DeckRow = {
  id: string;
  tenantId: string;
  ownerMembershipId: string | null;
  title: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
};

export type MyDeckRow = DeckRow & { itemCount: number };

function mapDeck(row: {
  id: string;
  tenant_id: string;
  created_by_membership_id: string | null;
  title: string;
  slug: string;
  created_at: Date;
  updated_at: Date;
}): DeckRow {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    ownerMembershipId: row.created_by_membership_id,
    title: row.title,
    slug: row.slug,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function insertDeck(args: {
  tx: Tx;
  tenantId: string;
  membershipId: string;
  title: string;
}): Promise<DeckRow> {
  const id = createUuidV7();
  const slug = `deck-${id.slice(0, 8)}`;

  const rows = await args.tx.$queryRaw<
    Array<{
      id: string;
      tenant_id: string;
      created_by_membership_id: string | null;
      title: string;
      slug: string;
      created_at: Date;
      updated_at: Date;
    }>
  >`
    insert into item_collections (
      id, tenant_id, slug, title, collection_type, status,
      created_by_membership_id, created_at, updated_at
    )
    values (
      ${id}::uuid,
      ${args.tenantId}::uuid,
      ${slug},
      ${args.title},
      'deck',
      'PUBLISHED'::"PublishStatus",
      ${args.membershipId}::uuid,
      now(),
      now()
    )
    returning id::text, tenant_id::text, created_by_membership_id::text, title, slug, created_at, updated_at
  `;

  const row = rows[0];
  if (!row) throw new Error("PRACTICE_DECK_CREATE_FAILED");
  return mapDeck(row);
}

/** Loads any deck (tenant or learner-owned). Callers must assert ownership. */
export async function findDeckById(args: { tx: Tx; deckId: string }): Promise<DeckRow | null> {
  const rows = await args.tx.$queryRaw<
    Array<{
      id: string;
      tenant_id: string;
      created_by_membership_id: string | null;
      title: string;
      slug: string;
      created_at: Date;
      updated_at: Date;
    }>
  >`
    select id::text, tenant_id::text, created_by_membership_id::text, title, slug, created_at, updated_at
    from item_collections
    where id = ${args.deckId}::uuid
      and deleted_at is null
      and collection_type = 'deck'
    limit 1
  `;

  const row = rows[0];
  return row ? mapDeck(row) : null;
}

export async function listMyDecks(args: { tx: Tx; membershipId: string }): Promise<MyDeckRow[]> {
  const rows = await args.tx.$queryRaw<
    Array<{
      id: string;
      tenant_id: string;
      created_by_membership_id: string | null;
      title: string;
      slug: string;
      created_at: Date;
      updated_at: Date;
      item_count: bigint;
    }>
  >`
    select
      c.id::text,
      c.tenant_id::text,
      c.created_by_membership_id::text,
      c.title,
      c.slug,
      c.created_at,
      c.updated_at,
      (
        select count(*)::bigint
        from item_collection_items ici
        where ici.collection_id = c.id
      ) as item_count
    from item_collections c
    where c.deleted_at is null
      and c.collection_type = 'deck'
      and c.created_by_membership_id = ${args.membershipId}::uuid
    order by c.updated_at desc, c.id desc
    limit 100
  `;

  return rows.map((row) => ({ ...mapDeck(row), itemCount: Number(row.item_count) }));
}

export async function updateDeckTitle(args: {
  tx: Tx;
  deckId: string;
  title: string;
}): Promise<void> {
  await args.tx.$executeRaw`
    update item_collections
    set title = ${args.title}, updated_at = now()
    where id = ${args.deckId}::uuid
  `;
}

export async function softDeleteDeck(args: { tx: Tx; deckId: string }): Promise<void> {
  await args.tx.$executeRaw`
    update item_collections
    set deleted_at = now(), updated_at = now()
    where id = ${args.deckId}::uuid
  `;
}

/** Only published items of a practisable type may be curated into a deck. */
export async function findPractisableItem(args: {
  tx: Tx;
  itemId: string;
}): Promise<{ id: string; itemTypeKey: string } | null> {
  const rows = await args.tx.$queryRaw<Array<{ id: string; item_type_key: string }>>`
    select i.id::text, i.item_type_key
    from items i
    where i.id = ${args.itemId}::uuid
      and i.deleted_at is null
      and i.status = 'PUBLISHED'::"PublishStatus"
      and i.item_type_key in ('swipe', 'matching', 'mcq_single', 'true_false')
    limit 1
  `;
  const row = rows[0];
  return row ? { id: row.id, itemTypeKey: row.item_type_key } : null;
}

export async function findDeckItem(args: {
  tx: Tx;
  deckId: string;
  itemId: string;
}): Promise<{ id: string } | null> {
  const rows = await args.tx.$queryRaw<Array<{ id: string }>>`
    select id::text from item_collection_items
    where collection_id = ${args.deckId}::uuid and item_id = ${args.itemId}::uuid
    limit 1
  `;
  return rows[0] ?? null;
}

export async function addItemToDeck(args: {
  tx: Tx;
  tenantId: string;
  deckId: string;
  itemId: string;
}): Promise<void> {
  const id = createUuidV7();
  await args.tx.$executeRaw`
    insert into item_collection_items (id, tenant_id, collection_id, item_id, position, created_at)
    values (
      ${id}::uuid,
      ${args.tenantId}::uuid,
      ${args.deckId}::uuid,
      ${args.itemId}::uuid,
      (
        select coalesce(max(ici.position), 0) + 1
        from item_collection_items ici
        where ici.collection_id = ${args.deckId}::uuid
      ),
      now()
    )
  `;
}

export async function removeItemFromDeck(args: {
  tx: Tx;
  deckId: string;
  itemId: string;
}): Promise<boolean> {
  const result = await args.tx.$executeRaw`
    delete from item_collection_items
    where collection_id = ${args.deckId}::uuid and item_id = ${args.itemId}::uuid
  `;
  return Number(result) > 0;
}

export async function publishDeckCreatedEvent(args: {
  tx: Tx;
  ctx: { tenantId: string; actorMembershipId: string; requestId: string };
  deckId: string;
}): Promise<void> {
  await outbox.publish(args.tx, {
    ctx: {
      tenantId: args.ctx.tenantId,
      actorMembershipId: args.ctx.actorMembershipId,
      requestId: args.ctx.requestId,
    },
    eventType: "learning.practice_deck.created",
    aggregateType: "practice_deck",
    aggregateId: args.deckId,
    payload: {
      tenantId: args.ctx.tenantId,
      deckId: args.deckId,
      membershipId: args.ctx.actorMembershipId,
    },
    idempotencyKey: `${args.ctx.requestId}:learning.practice_deck.created:${args.deckId}`,
  });
}

export type PracticeItemRow = { itemId: string; stem: string; itemTypeKey: string };

const PRACTISABLE_TYPES = ["swipe", "matching", "mcq_single", "true_false"];

function readStem(stemJson: unknown): string {
  if (stemJson && typeof stemJson === "object" && !Array.isArray(stemJson)) {
    const value = (stemJson as Record<string, unknown>)["stem"];
    if (typeof value === "string") return value;
  }
  return "";
}

/** Published, practisable items the learner can curate. Stems only. */
export async function listPractisableItems(args: {
  tx: Tx;
  q?: string | undefined;
  limit: number;
}): Promise<PracticeItemRow[]> {
  const search = args.q ? `%${args.q}%` : null;
  const rows = await args.tx.$queryRaw<
    Array<{ id: string; item_type_key: string; stem_json: unknown }>
  >`
    select i.id::text, i.item_type_key, i.stem_json
    from items i
    where i.deleted_at is null
      and i.status = 'PUBLISHED'::"PublishStatus"
      and i.item_type_key = any(${PRACTISABLE_TYPES}::text[])
      and (${search}::text is null or i.stem_json->>'stem' ilike ${search}::text)
    order by i.updated_at desc, i.id desc
    limit ${args.limit}
  `;
  return rows.map((row) => ({
    itemId: row.id,
    stem: readStem(row.stem_json),
    itemTypeKey: row.item_type_key,
  }));
}

export async function listDeckItems(args: { tx: Tx; deckId: string }): Promise<PracticeItemRow[]> {
  const rows = await args.tx.$queryRaw<
    Array<{ id: string; item_type_key: string; stem_json: unknown }>
  >`
    select i.id::text, i.item_type_key, i.stem_json
    from item_collection_items ici
    inner join items i
      on i.id = ici.item_id
     and i.deleted_at is null
    where ici.collection_id = ${args.deckId}::uuid
    order by ici.position asc
  `;
  return rows.map((row) => ({
    itemId: row.id,
    stem: readStem(row.stem_json),
    itemTypeKey: row.item_type_key,
  }));
}
