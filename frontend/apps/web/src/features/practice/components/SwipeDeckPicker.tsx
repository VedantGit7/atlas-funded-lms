"use client";

import type { z } from "zod";
import type { dueQueueResponseSchema } from "@atlas/contracts/practice/practice.schemas";

export type DueQueueData = z.infer<typeof dueQueueResponseSchema>["data"];
export type PracticeDeckOption = DueQueueData["availableDecks"][number];
export type SafePracticeCard = DueQueueData["items"][number]["card"];

type DeckPickerProps = {
  dueCount: number;
  decks: PracticeDeckOption[];
  starting: boolean;
  onStartDue: () => void;
  onStartDeck: (collectionId: string) => void;
};

export function SwipeDeckPicker({
  dueCount,
  decks,
  starting,
  onStartDue,
  onStartDeck,
}: DeckPickerProps) {
  return (
    <section className="space-y-4 rounded border p-6" aria-labelledby="swipe-deck-picker-title">
      <div>
        <h2 id="swipe-deck-picker-title" className="text-lg font-semibold">
          Choose a practice deck
        </h2>
        <p className="text-sm text-muted-foreground">
          Start with cards that are due for review or pick a published deck.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          className="rounded border p-4 text-left hover:bg-muted disabled:opacity-60"
          disabled={starting}
          onClick={onStartDue}
        >
          <div className="font-medium">Due queue</div>
          <div className="text-sm text-muted-foreground">
            {dueCount > 0
              ? `${String(dueCount)} cards due now`
              : "Review due cards first, then new cards"}
          </div>
        </button>

        {decks.map((deck) => (
          <button
            key={deck.collectionId}
            type="button"
            className="rounded border p-4 text-left hover:bg-muted disabled:opacity-60"
            disabled={starting}
            onClick={() => {
              onStartDeck(deck.collectionId);
            }}
          >
            <div className="font-medium">{deck.title}</div>
            <div className="text-sm text-muted-foreground">{deck.itemCount} swipe cards</div>
          </button>
        ))}
      </div>
    </section>
  );
}
