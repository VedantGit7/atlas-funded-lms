import { createTenantResourceRef } from "@atlas/authorization";
import type { TenantTx } from "@atlas/db";
import { deckItemAlreadyAdded, deckItemNotEligible, deckNotFound } from "./decks.errors";
import {
  addItemToDeck,
  findDeckById,
  findDeckItem,
  findPractisableItem,
  insertDeck,
  listMyDecks,
  publishDeckCreatedEvent,
  removeItemFromDeck,
  listDeckItems,
  listPractisableItems,
  softDeleteDeck,
  updateDeckTitle,
  type DeckRow,
  type PracticeItemRow,
} from "./decks.repository";
import type {
  AddDeckItemBody,
  CreateDeckBody,
  DeckItemQuery,
  PracticeItemsQuery,
  UpdateDeckBody,
} from "./schemas";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

const PRACTISABLE_ITEM_TYPES = ["swipe", "matching", "mcq_single", "true_false"] as const;
type PractisableItemType = (typeof PRACTISABLE_ITEM_TYPES)[number];

/** Narrows the raw type key to the practisable union the contract exposes. */
function toPractisableItemType(itemTypeKey: string): PractisableItemType {
  return (PRACTISABLE_ITEM_TYPES as readonly string[]).includes(itemTypeKey)
    ? (itemTypeKey as PractisableItemType)
    : "swipe";
}

function serializePracticeItem(item: PracticeItemRow) {
  return {
    itemId: item.itemId,
    stem: item.stem,
    itemTypeKey: toPractisableItemType(item.itemTypeKey),
  };
}

function serializeDeck(deck: DeckRow, itemCount: number) {
  return {
    id: deck.id,
    title: deck.title,
    slug: deck.slug,
    itemCount,
    createdAt: deck.createdAt.toISOString(),
    updatedAt: deck.updatedAt.toISOString(),
  };
}

/**
 * Loads a deck the actor owns. Tenant/studio decks (owner null) and other
 * learners' decks both surface as 404 so deck existence is never leaked.
 */
async function loadOwnedDeck(tx: TenantTx, ctx: ServiceCtx, deckId: string): Promise<DeckRow> {
  const deck = await findDeckById({ tx, deckId });

  if (
    !deck ||
    deck.tenantId !== ctx.tenantId ||
    deck.ownerMembershipId === null ||
    deck.ownerMembershipId !== ctx.actorMembershipId
  ) {
    throw deckNotFound();
  }

  return deck;
}

export async function createMyDeck(tx: TenantTx, ctx: ServiceCtx, input: CreateDeckBody) {
  const deck = await insertDeck({
    tx,
    tenantId: ctx.tenantId,
    membershipId: ctx.actorMembershipId,
    title: input.title,
  });

  await publishDeckCreatedEvent({ tx, ctx, deckId: deck.id });

  return { data: serializeDeck(deck, 0) };
}

export async function listMyDecksService(tx: TenantTx, ctx: ServiceCtx) {
  const decks = await listMyDecks({ tx, membershipId: ctx.actorMembershipId });
  return {
    data: {
      items: decks.map((deck) => serializeDeck(deck, deck.itemCount)),
    },
  };
}

export async function renameMyDeck(
  tx: TenantTx,
  ctx: ServiceCtx,
  deckId: string,
  input: UpdateDeckBody,
) {
  const deck = await loadOwnedDeck(tx, ctx, deckId);
  await updateDeckTitle({ tx, deckId: deck.id, title: input.title });
  return { data: serializeDeck({ ...deck, title: input.title, updatedAt: new Date() }, 0) };
}

export async function deleteMyDeck(tx: TenantTx, ctx: ServiceCtx, deckId: string) {
  const deck = await loadOwnedDeck(tx, ctx, deckId);
  await softDeleteDeck({ tx, deckId: deck.id });
  return { data: { id: deck.id, deleted: true as const } };
}

export async function addItemToMyDeck(
  tx: TenantTx,
  ctx: ServiceCtx,
  deckId: string,
  input: AddDeckItemBody,
) {
  const deck = await loadOwnedDeck(tx, ctx, deckId);

  const item = await findPractisableItem({ tx, itemId: input.itemId });
  if (!item) {
    throw deckItemNotEligible();
  }

  const existing = await findDeckItem({ tx, deckId: deck.id, itemId: input.itemId });
  if (existing) {
    throw deckItemAlreadyAdded();
  }

  await addItemToDeck({ tx, tenantId: ctx.tenantId, deckId: deck.id, itemId: input.itemId });

  const decks = await listMyDecks({ tx, membershipId: ctx.actorMembershipId });
  const refreshed = decks.find((entry) => entry.id === deck.id);
  return { data: serializeDeck(deck, refreshed?.itemCount ?? 0) };
}

export async function removeItemFromMyDeck(
  tx: TenantTx,
  ctx: ServiceCtx,
  deckId: string,
  query: DeckItemQuery,
) {
  const deck = await loadOwnedDeck(tx, ctx, deckId);

  const removed = await removeItemFromDeck({ tx, deckId: deck.id, itemId: query.itemId });
  if (!removed) {
    throw deckNotFound();
  }

  const decks = await listMyDecks({ tx, membershipId: ctx.actorMembershipId });
  const refreshed = decks.find((entry) => entry.id === deck.id);
  return { data: serializeDeck(deck, refreshed?.itemCount ?? 0) };
}

/** Resource ref for creating a deck: the actor is always its own owner. */
export function loadMyDeckCreateResourceRef(args: { ctx: ServiceCtx }) {
  return Promise.resolve(
    createTenantResourceRef({
      type: "item_collection",
      id: args.ctx.actorMembershipId,
      tenantId: args.ctx.tenantId,
      ownerMembershipId: args.ctx.actorMembershipId,
      relationships: { selfDeck: args.ctx.actorMembershipId },
    }),
  );
}

/**
 * Resource ref for an existing deck. `selfDeck` only carries the owner, so the
 * authorization layer rejects other learners and tenant decks before the
 * service-level ownership check runs.
 */
export async function loadMyDeckResourceRef(args: {
  tx: TenantTx;
  ctx: ServiceCtx;
  deckId: string;
}) {
  const deck = await findDeckById({ tx: args.tx, deckId: args.deckId });

  if (!deck || deck.tenantId !== args.ctx.tenantId) {
    throw deckNotFound();
  }

  return createTenantResourceRef({
    type: "item_collection",
    id: deck.id,
    tenantId: args.ctx.tenantId,
    ownerMembershipId: deck.ownerMembershipId,
    relationships: deck.ownerMembershipId ? { selfDeck: deck.ownerMembershipId } : {},
  });
}

export async function listPracticeItemsService(
  tx: TenantTx,
  _ctx: ServiceCtx,
  query: PracticeItemsQuery,
) {
  const items = await listPractisableItems({ tx, q: query.q, limit: query.limit });
  return { data: { items: items.map(serializePracticeItem) } };
}

export async function listMyDeckItems(tx: TenantTx, ctx: ServiceCtx, deckId: string) {
  const deck = await loadOwnedDeck(tx, ctx, deckId);
  const items = await listDeckItems({ tx, deckId: deck.id });
  return { data: { items: items.map(serializePracticeItem) } };
}
