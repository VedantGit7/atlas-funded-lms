import { beforeEach, describe, expect, it, vi } from "vitest";
import { hasRequiredRelationship } from "@atlas/authorization";

const tenantId = "018f0000-0000-7000-8000-000000000001";
const ownerMembershipId = "018f0000-0000-7000-8000-000000000020";
const otherMembershipId = "018f0000-0000-7000-8000-000000000021";
const deckId = "018f0000-0000-7000-8000-000000000030";

const { mockFindDeckById, mockUpdateDeckTitle, mockSoftDeleteDeck, mockListMyDecks } = vi.hoisted(
  () => ({
    mockFindDeckById: vi.fn(),
    mockUpdateDeckTitle: vi.fn(),
    mockSoftDeleteDeck: vi.fn(),
    mockListMyDecks: vi.fn(),
  }),
);

vi.mock("../../../backend/apps/api/src/server/decks/decks.repository", () => ({
  findDeckById: (...args: unknown[]) => mockFindDeckById(...args),
  updateDeckTitle: (...args: unknown[]) => mockUpdateDeckTitle(...args),
  softDeleteDeck: (...args: unknown[]) => mockSoftDeleteDeck(...args),
  listMyDecks: (...args: unknown[]) => mockListMyDecks(...args),
  insertDeck: vi.fn(),
  addItemToDeck: vi.fn(),
  removeItemFromDeck: vi.fn(),
  findDeckItem: vi.fn(),
  findPractisableItem: vi.fn(),
  publishDeckCreatedEvent: vi.fn(async () => undefined),
}));

import {
  deleteMyDeck,
  loadMyDeckResourceRef,
  renameMyDeck,
} from "../../../backend/apps/api/src/server/decks/decks.service";

const ctx = { tenantId, actorMembershipId: ownerMembershipId, requestId: "req-1" };
const tx = {} as never;

function deck(ownerId: string | null) {
  return {
    id: deckId,
    tenantId,
    ownerMembershipId: ownerId,
    title: "My deck",
    slug: "deck-1",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("deck ownership enforcement (service)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListMyDecks.mockResolvedValue([]);
  });

  it("lets the owner rename their own deck", async () => {
    mockFindDeckById.mockResolvedValue(deck(ownerMembershipId));
    const result = await renameMyDeck(tx, ctx, deckId, { title: "Renamed" });
    expect(result.data.title).toBe("Renamed");
    expect(mockUpdateDeckTitle).toHaveBeenCalledOnce();
  });

  it("refuses to rename another learner's deck", async () => {
    mockFindDeckById.mockResolvedValue(deck(otherMembershipId));
    await expect(renameMyDeck(tx, ctx, deckId, { title: "Hijack" })).rejects.toMatchObject({
      status: 404,
    });
    expect(mockUpdateDeckTitle).not.toHaveBeenCalled();
  });

  it("refuses to rename a tenant/studio deck (no owner)", async () => {
    mockFindDeckById.mockResolvedValue(deck(null));
    await expect(renameMyDeck(tx, ctx, deckId, { title: "Hijack" })).rejects.toMatchObject({
      status: 404,
    });
    expect(mockUpdateDeckTitle).not.toHaveBeenCalled();
  });

  it("refuses to delete another learner's deck", async () => {
    mockFindDeckById.mockResolvedValue(deck(otherMembershipId));
    await expect(deleteMyDeck(tx, ctx, deckId)).rejects.toMatchObject({ status: 404 });
    expect(mockSoftDeleteDeck).not.toHaveBeenCalled();
  });

  it("refuses to delete a tenant/studio deck", async () => {
    mockFindDeckById.mockResolvedValue(deck(null));
    await expect(deleteMyDeck(tx, ctx, deckId)).rejects.toMatchObject({ status: 404 });
    expect(mockSoftDeleteDeck).not.toHaveBeenCalled();
  });

  it("refuses a deck from another tenant", async () => {
    mockFindDeckById.mockResolvedValue({ ...deck(ownerMembershipId), tenantId: "other-tenant" });
    await expect(deleteMyDeck(tx, ctx, deckId)).rejects.toMatchObject({ status: 404 });
  });
});

describe("deck resource ref (authorization layer)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks the owner via selfDeck so the permission resolves", async () => {
    mockFindDeckById.mockResolvedValue(deck(ownerMembershipId));
    const ref = await loadMyDeckResourceRef({ tx, ctx, deckId });

    expect(
      hasRequiredRelationship({
        actor: { membershipId: ownerMembershipId } as never,
        resource: ref,
        permission: "practice_deck.manage",
      }),
    ).toBe(true);
  });

  it("denies another learner even with the permission granted", async () => {
    mockFindDeckById.mockResolvedValue(deck(ownerMembershipId));
    const ref = await loadMyDeckResourceRef({ tx, ctx, deckId });

    expect(
      hasRequiredRelationship({
        actor: { membershipId: otherMembershipId } as never,
        resource: ref,
        permission: "practice_deck.manage",
      }),
    ).toBe(false);
  });

  it("denies everyone on a tenant/studio deck (no selfDeck relationship)", async () => {
    mockFindDeckById.mockResolvedValue(deck(null));
    const ref = await loadMyDeckResourceRef({ tx, ctx, deckId });

    expect(
      hasRequiredRelationship({
        actor: { membershipId: ownerMembershipId } as never,
        resource: ref,
        permission: "practice_deck.manage",
      }),
    ).toBe(false);
  });
});
