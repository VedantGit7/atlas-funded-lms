"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { z } from "zod";
import {
  AlarmClock,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  Copy,
  Layers,
  Loader2,
  Pencil,
  PlusCircle,
  Puzzle,
  Timer,
  Zap,
} from "lucide-react";
import { CreateDeckDialog } from "./CreateDeckDialog";
import { DeckEditorDialog } from "./DeckEditorDialog";
import type {
  dueQueueResponseSchema,
  practiceEngineSchema,
} from "@atlas/contracts/practice/practice.schemas";

type DueQueueData = z.infer<typeof dueQueueResponseSchema>["data"];
type DeckOption = DueQueueData["availableDecks"][number];
type PracticeEngine = z.infer<typeof practiceEngineSchema>;

type PracticeHubProps = {
  due: DueQueueData;
  starting: boolean;
  onStartDue: (engine: PracticeEngine) => void;
  onStartDeck: (collectionId: string, engine: PracticeEngine) => void;
};

/**
 * Practice modes. Live modes start a real session; the remaining engines are
 * still being built and are marked rather than faked.
 */
const MODES: Array<{
  key: string;
  label: string;
  tagline: string;
  Icon: typeof Layers;
  live: boolean;
  engine?: PracticeEngine;
}> = [
  { key: "swipe", label: "Swipe", tagline: "Flagship fast-review", Icon: Layers, live: true, engine: "swipe" },
  { key: "flashcards", label: "Flashcards", tagline: "Classic flip-to-reveal", Icon: Copy, live: true, engine: "flashcards" },
  { key: "learn", label: "Learn", tagline: "Adaptive quiz-style", Icon: BrainCircuit, live: true, engine: "learn" },
  { key: "test", label: "Test", tagline: "Timed, graded test", Icon: Timer, live: true, engine: "test" },
  { key: "match", label: "Match", tagline: "Pair them correctly", Icon: Puzzle, live: true, engine: "match" },
];

function Ring({ percent }: { percent: number }) {
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.max(0, Math.min(100, percent)) / 100) * circumference;
  return (
    <div className="relative h-12 w-12 shrink-0">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="24" cy="24" r={radius} fill="transparent" strokeWidth="4" style={{ stroke: "var(--muted)" }} />
        <circle
          cx="24"
          cy="24"
          r={radius}
          fill="transparent"
          strokeWidth="4"
          strokeLinecap="round"
          style={{ stroke: "var(--success)", strokeDasharray: circumference, strokeDashoffset: offset }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold" style={{ color: "var(--success)" }}>
        {percent}%
      </span>
    </div>
  );
}

function DeckCard({
  deck,
  onOpen,
  onEdit,
}: {
  deck: DeckOption;
  onOpen: () => void;
  onEdit: () => void;
}) {
  const clean = deck.dueCount === 0;
  return (
    <div className="group relative flex flex-col gap-6 rounded-2xl border border-border bg-card p-6 text-left transition-all hover:shadow-lg motion-safe:hover:-translate-y-1">
      {deck.owned ? (
        <button
          type="button"
          aria-label={`Edit ${deck.title}`}
          onClick={onEdit}
          className="absolute right-4 top-4 z-10 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : null}
      <button type="button" onClick={onOpen} className="flex flex-1 flex-col gap-6 text-left">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h4 className="truncate text-lg font-bold text-primary">{deck.title}</h4>
          <p className="text-xs text-muted-foreground">
            {deck.itemCount} {deck.itemCount === 1 ? "item" : "items"}
            {deck.category ? ` · ${deck.category}` : ""}
          </p>
        </div>
        <Ring percent={deck.masteryPercent} />
      </div>
      <div className="mt-auto flex items-center justify-between">
        <span
          className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-bold uppercase"
          style={
            clean
              ? { background: "color-mix(in srgb, var(--success) 15%, transparent)", color: "var(--success)" }
              : { background: "color-mix(in srgb, var(--destructive) 15%, transparent)", color: "var(--destructive)" }
          }
        >
          {clean ? <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> : <AlarmClock className="h-3 w-3" aria-hidden="true" />}
          {clean ? "Clean" : `${String(deck.dueCount)} due`}
        </span>
        <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" aria-hidden="true" />
      </div>
      </button>
    </div>
  );
}

export function PracticeHub({ due, starting, onStartDue, onStartDeck }: PracticeHubProps) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<{ id: string; title: string } | null>(null);
  const dueTotal = due.dueTotal;
  const hasDue = dueTotal > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-12">
      {/* Header */}
      <header className="space-y-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">Practice</h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          Review what you&apos;ve learned, on your schedule. Keep your momentum high and your knowledge sharp.
        </p>
      </header>

      {/* Due callout */}
      <section
        className="relative overflow-hidden rounded-2xl border-2 p-8 md:p-10"
        style={{
          borderColor: "color-mix(in srgb, var(--primary) 30%, transparent)",
          background:
            "radial-gradient(120% 120% at 100% 100%, color-mix(in srgb, var(--primary) 12%, transparent), transparent 60%), color-mix(in srgb, var(--primary) 8%, var(--card))",
        }}
      >
        <div className="relative z-10 flex flex-col items-center justify-between gap-8 text-center md:flex-row md:text-left">
          <div>
            <div className="text-5xl font-extrabold tracking-tight text-primary sm:text-6xl">{dueTotal}</div>
            <p className="mt-1 text-xl font-bold text-foreground">
              {dueTotal === 1 ? "card due for review" : "cards due for review"}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {hasDue
                ? "Keep your streak alive. Secure your progress now."
                : "You're all caught up. Start any deck to get ahead."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              onStartDue("swipe");
            }}
            disabled={starting || !hasDue}
            className="inline-flex shrink-0 items-center gap-3 rounded-xl bg-primary px-8 py-4 text-lg font-bold text-primary-foreground shadow-lg transition-transform hover:opacity-95 disabled:opacity-50 motion-safe:hover:scale-105 motion-safe:active:scale-95"
          >
            {starting ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : null}
            {hasDue ? "Start due review" : "Nothing due"}
            {!starting && hasDue ? <Zap className="h-5 w-5" fill="currentColor" aria-hidden="true" /> : null}
          </button>
        </div>
      </section>

      {/* Mode selector */}
      <section className="space-y-6">
        <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Select mode</h3>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          {MODES.map((mode) => {
            const disabled = !mode.live;
            const content = (
              <>
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-primary transition-colors group-hover:bg-primary/15">
                  <mode.Icon className="h-6 w-6" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-bold text-primary">{mode.label}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{mode.tagline}</p>
                </div>
                {!mode.live ? (
                  <span className="absolute right-2 top-2 rounded-full bg-muted px-2 py-0.5 text-[9px] font-bold uppercase text-muted-foreground">
                    Soon
                  </span>
                ) : null}
              </>
            );
            const base =
              "group relative flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-6 text-center transition-all";
            return mode.live && mode.engine ? (
              <button
                key={mode.key}
                type="button"
                onClick={() => {
                  if (mode.engine) onStartDue(mode.engine);
                }}
                disabled={disabled}
                className={`${base} hover:border-primary hover:shadow-md disabled:opacity-60`}
              >
                {content}
              </button>
            ) : (
              <div key={mode.key} className={`${base} cursor-default opacity-70`} aria-disabled="true">
                {content}
              </div>
            );
          })}
        </div>
      </section>

      {/* Decks */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Your decks</h3>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {due.availableDecks.map((deck) => (
            <DeckCard
              key={deck.collectionId}
              deck={deck}
              onOpen={() => {
                onStartDeck(deck.collectionId, "swipe");
              }}
              onEdit={() => {
                setEditing({ id: deck.collectionId, title: deck.title });
              }}
            />
          ))}
          <button
            type="button"
            onClick={() => {
              setCreateOpen(true);
            }}
            className="group flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-muted/40 p-6 text-muted-foreground transition-all hover:border-primary hover:text-primary"
          >
            <PlusCircle className="h-8 w-8" aria-hidden="true" />
            <p className="font-bold">Create new deck</p>
          </button>
        </div>
      </section>

      <CreateDeckDialog
        open={createOpen}
        onCancel={() => {
          setCreateOpen(false);
        }}
        onCreated={() => {
          setCreateOpen(false);
          router.refresh();
        }}
      />

      <DeckEditorDialog
        deckId={editing?.id ?? null}
        deckTitle={editing?.title ?? ""}
        onClose={() => {
          setEditing(null);
          router.refresh();
        }}
        onChanged={() => {
          router.refresh();
        }}
      />
    </div>
  );
}
