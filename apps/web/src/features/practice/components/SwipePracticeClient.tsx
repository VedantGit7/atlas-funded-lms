"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { z } from "zod";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import type {
  dueQueueResponseSchema,
  safePracticeCardSchema,
  startPracticeSessionResponseSchema,
  submitPracticeResponseResponseSchema,
  completePracticeSessionResponseSchema,
} from "../../../server/practice/practice.schemas";
import { SwipeDeckPicker } from "./SwipeDeckPicker";
import { SwipeSessionSummaryDialog } from "./SwipeSessionSummaryDialog";

type DueQueueData = z.infer<typeof dueQueueResponseSchema>["data"];
type SafeCard = z.infer<typeof safePracticeCardSchema>;
type StartSessionResponse = z.infer<typeof startPracticeSessionResponseSchema>;
type SubmitResponseEnvelope = z.infer<typeof submitPracticeResponseResponseSchema>;
type CompleteResponseEnvelope = z.infer<typeof completePracticeSessionResponseSchema>;
type SessionState = StartSessionResponse["data"]["session"];
type SubmitResponseData = SubmitResponseEnvelope["data"];
type CompleteSummary = CompleteResponseEnvelope["data"]["summary"];

type SwipePracticeClientProps = {
  initialDue: DueQueueData;
};

function readStem(card: SafeCard | null): string {
  if (!card) return "";
  const stem = card.contentJson["stem"];
  return typeof stem === "string" ? stem : "Swipe card";
}

function createResponseKey(sessionId: string, itemId: string): string {
  return `practice-response-${sessionId}-${itemId}`;
}

export function SwipePracticeClient({ initialDue }: SwipePracticeClientProps) {
  const [dueData] = useState(initialDue);
  const [session, setSession] = useState<SessionState | null>(null);
  const [card, setCard] = useState<SafeCard | null>(null);
  const [queuedNextCard, setQueuedNextCard] = useState<SafeCard | null>(null);
  const [feedback, setFeedback] = useState<SubmitResponseData["response"] | null>(null);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [completionSummary, setCompletionSummary] = useState<CompleteSummary | null>(null);
  const pendingRef = useRef<{ itemId: string; idempotencyKey: string } | null>(null);
  const reducedMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  const completeSession = useCallback(async (activeSession: SessionState) => {
    setCompleting(true);
    setError(null);
    try {
      const result = await clientApi.post<CompleteResponseEnvelope>(
        `/api/v1/practice-sessions/${activeSession.id}/complete`,
        {},
        `practice-complete-${activeSession.id}`,
      );
      setCompletionSummary(result.data.summary);
      setSummaryOpen(true);
      setSession({
        ...activeSession,
        status: "completed",
        answeredCount: result.data.summary.answeredCount,
      });
      setCard(null);
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Unable to complete session.");
    } finally {
      setCompleting(false);
    }
  }, []);

  const advanceToNextCard = useCallback(
    async (activeSession: SessionState, next: SafeCard | null) => {
      setFeedback(null);
      if (next) {
        setCard(next);
        setQueuedNextCard(null);
        return;
      }

      if (activeSession.answeredCount >= activeSession.totalItems) {
        await completeSession(activeSession);
        return;
      }

      setCard(null);
    },
    [completeSession],
  );

  const submitAction = useCallback(
    async (action: "known" | "unknown") => {
      if (!session || !card || submitting || completing || feedback) return;

      const idempotencyKey =
        pendingRef.current?.itemId === card.itemId
          ? pendingRef.current.idempotencyKey
          : createResponseKey(session.id, card.itemId);

      pendingRef.current = { itemId: card.itemId, idempotencyKey };

      setSubmitting(true);
      setError(null);

      try {
        const result = await clientApi.postWithKey<SubmitResponseEnvelope>(
          `/api/v1/practice-sessions/${session.id}/responses`,
          { itemId: card.itemId, action },
          idempotencyKey,
        );

        pendingRef.current = null;
        const nextSession = {
          ...session,
          answeredCount: result.data.progress.answeredCount,
        };

        setSession(nextSession);
        setFeedback(result.data.response);
        setQueuedNextCard(result.data.nextCard);

        if (
          !result.data.nextCard &&
          result.data.progress.answeredCount >= result.data.progress.totalItems
        ) {
          await completeSession(nextSession);
          return;
        }

        if (reducedMotion) {
          return;
        }

        window.setTimeout(() => {
          void advanceToNextCard(nextSession, result.data.nextCard);
        }, 900);
      } catch (err) {
        setError(err instanceof ClientApiError ? err.message : "Unable to submit response.");
      } finally {
        setSubmitting(false);
      }
    },
    [
      advanceToNextCard,
      card,
      completeSession,
      completing,
      feedback,
      reducedMotion,
      session,
      submitting,
    ],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!session || feedback || submitting || completing) return;
      if (event.key === "ArrowRight" || event.key.toLowerCase() === "k") {
        event.preventDefault();
        void submitAction("known");
      }
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "u") {
        event.preventDefault();
        void submitAction("unknown");
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [completing, feedback, session, submitAction, submitting]);

  async function startSession(args: { mode: "due" | "collection"; collectionId?: string }) {
    setStarting(true);
    setError(null);
    try {
      const result = await clientApi.post<StartSessionResponse>(
        "/api/v1/practice-sessions",
        {
          mode: args.mode,
          ...(args.collectionId ? { collectionId: args.collectionId } : {}),
          maxItems: 10,
        },
        args.mode === "due"
          ? "practice-start-due"
          : `practice-start-deck-${args.collectionId ?? "deck"}`,
      );
      setSession(result.data.session);
      setCard(result.data.card);
      setFeedback(null);
      setQueuedNextCard(null);
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Unable to start practice session.");
    } finally {
      setStarting(false);
    }
  }

  if (!session) {
    return (
      <div className="space-y-4">
        <SwipeDeckPicker
          dueCount={dueData.items.length}
          decks={dueData.availableDecks}
          starting={starting}
          onStartDue={() => {
            void startSession({ mode: "due" });
          }}
          onStartDeck={(collectionId) => {
            void startSession({ mode: "collection", collectionId });
          }}
        />
        {error ? (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <section className="space-y-4" aria-live="polite">
      <div className="flex items-center justify-between text-sm text-neutral-600">
        <span data-testid="swipe-progress">
          Progress: {session.answeredCount} / {session.totalItems}
        </span>
        <span>{session.mode === "due" ? "Due queue session" : "Deck session"}</span>
      </div>

      <div
        className={`rounded border p-8 ${reducedMotion ? "" : "transition-transform duration-300"}`}
        data-testid="swipe-card"
      >
        <p className="text-lg">{readStem(card)}</p>
      </div>

      {feedback ? (
        <div
          className="rounded border border-neutral-300 bg-neutral-50 p-4"
          role="status"
          data-testid="swipe-feedback"
        >
          <p className="font-medium">{feedback.feedbackLabel}</p>
          <p className="text-sm text-neutral-600">Server-confirmed result for this card.</p>
          {reducedMotion ? (
            <button
              type="button"
              className="mt-3 rounded border px-3 py-2"
              onClick={() => {
                void advanceToNextCard(session, queuedNextCard);
              }}
            >
              Continue
            </button>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded border px-4 py-2 disabled:opacity-60"
            disabled={submitting || completing || !card}
            data-testid="swipe-known-button"
            onClick={() => {
              void submitAction("known");
            }}
          >
            Known
          </button>
          <button
            type="button"
            className="rounded border px-4 py-2 disabled:opacity-60"
            disabled={submitting || completing || !card}
            data-testid="swipe-unknown-button"
            onClick={() => {
              void submitAction("unknown");
            }}
          >
            Unknown
          </button>
        </div>
      )}

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <SwipeSessionSummaryDialog
        open={summaryOpen}
        summary={
          completionSummary ?? {
            totalItems: session.totalItems,
            answeredCount: session.answeredCount,
            correctCount: 0,
          }
        }
        onClose={() => {
          setSummaryOpen(false);
          setSession(null);
          setCard(null);
          setFeedback(null);
        }}
      />
    </section>
  );
}
