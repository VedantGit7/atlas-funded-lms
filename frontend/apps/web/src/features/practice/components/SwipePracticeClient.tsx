"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { z } from "zod";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import { captureProductEvent } from "../../../observability/capture-product-event";
import type {
  dueQueueResponseSchema,
  practiceEngineSchema,
  safePracticeCardSchema,
  startPracticeSessionResponseSchema,
  submitPracticeResponseResponseSchema,
  completePracticeSessionResponseSchema,
} from "@atlas/contracts/practice/practice.schemas";
import { ChoiceCard } from "./ChoiceCard";
import { MatchCard } from "./MatchCard";
import { TestTimer } from "./TestTimer";
import { PracticeHub } from "./PracticeHub";
import { SwipeSessionSummaryDialog } from "./SwipeSessionSummaryDialog";

type DueQueueData = z.infer<typeof dueQueueResponseSchema>["data"];
type SafeCard = z.infer<typeof safePracticeCardSchema>;
type PracticeEngine = z.infer<typeof practiceEngineSchema>;
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
  const [revealed, setRevealed] = useState(false);
  const [queuedNextCard, setQueuedNextCard] = useState<SafeCard | null>(null);
  const [feedback, setFeedback] = useState<SubmitResponseData["response"] | null>(null);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [completionSummary, setCompletionSummary] = useState<CompleteSummary | null>(null);
  const pendingRef = useRef<{ itemId: string; idempotencyKey: string } | null>(null);
  const cardStartedAtRef = useRef<number>(Date.now());
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
      captureProductEvent("swipe_session_completed", {
        routeGroup: "learner",
        source: "practice",
        outcome: "completed",
      });
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
      setRevealed(false);
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

  const submitResponse = useCallback(
    async (
      payload:
        | { action: "known" | "unknown" }
        | { pairs: Record<string, string> }
        | { selectedOptionId: string },
    ) => {
      if (!session || !card || submitting || completing || feedback) return;

      const idempotencyKey =
        pendingRef.current?.itemId === card.itemId
          ? pendingRef.current.idempotencyKey
          : createResponseKey(session.id, card.itemId);

      pendingRef.current = { itemId: card.itemId, idempotencyKey };

      setSubmitting(true);
      setError(null);

      const latencyMs = Math.max(0, Date.now() - cardStartedAtRef.current);

      try {
        const result = await clientApi.postWithKey<SubmitResponseEnvelope>(
          `/api/v1/practice-sessions/${session.id}/responses`,
          { itemId: card.itemId, ...payload, latencyMs },
          idempotencyKey,
        );

        pendingRef.current = null;
        const nextSession = {
          ...session,
          answeredCount: result.data.progress.answeredCount,
        };

        setSession(nextSession);
        setQueuedNextCard(result.data.nextCard);

        // Timed tests reveal nothing per answer; move on immediately.
        if (nextSession.engine === "test") {
          await advanceToNextCard(nextSession, result.data.nextCard);
          return;
        }

        setFeedback(result.data.response);

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
    cardStartedAtRef.current = Date.now();
  }, [card?.itemId]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!session || feedback || submitting || completing) return;
      // Graded cards submit from their own control, not the keyboard.
      if (card?.rendererKey === "matching" || card?.rendererKey === "choice") return;
      // Flashcards must be revealed before they can be self-rated.
      if (card?.rendererKey === "flashcard" && !revealed) return;
      if (event.key === "ArrowRight" || event.key.toLowerCase() === "k") {
        event.preventDefault();
        void submitResponse({ action: "known" });
      }
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "u") {
        event.preventDefault();
        void submitResponse({ action: "unknown" });
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [card, completing, feedback, revealed, session, submitResponse, submitting]);

  async function startSession(args: {
    mode: "due" | "collection";
    engine: PracticeEngine;
    collectionId?: string;
  }) {
    setStarting(true);
    setError(null);
    try {
      const result = await clientApi.post<StartSessionResponse>(
        "/api/v1/practice-sessions",
        {
          mode: args.mode,
          engine: args.engine,
          ...(args.collectionId ? { collectionId: args.collectionId } : {}),
          maxItems: 10,
        },
        args.mode === "due"
          ? `practice-start-due-${args.engine}`
          : `practice-start-deck-${args.engine}-${args.collectionId ?? "deck"}`,
      );
      setSession(result.data.session);
      setCard(result.data.card);
      setRevealed(false);
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
        <PracticeHub
          due={dueData}
          starting={starting}
          onStartDue={(engine) => {
            void startSession({ mode: "due", engine });
          }}
          onStartDeck={(collectionId, engine) => {
            void startSession({ mode: "collection", engine, collectionId });
          }}
        />
        {error ? (
          <p className="mx-auto max-w-5xl text-sm text-[var(--destructive)]" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  const isFlashcard = card?.rendererKey === "flashcard";

  // When the server-set deadline passes, submit what was answered and grade it.
  const activeSession = session;
  const handleExpire = () => {
    if (activeSession.status === "completed" || completing) return;
    void completeSession(activeSession);
  };

  return (
    <section className="mx-auto max-w-2xl space-y-6" aria-live="polite">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold text-foreground" data-testid="swipe-progress">
          Progress: {session.answeredCount} / {session.totalItems}
        </span>
        <span className="flex items-center gap-3 text-muted-foreground">
          {session.expiresAt ? (
            <TestTimer expiresAt={session.expiresAt} onExpire={handleExpire} />
          ) : null}
          {session.mode === "due" ? "Due queue session" : "Deck session"}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500"
          style={{
            width: `${String(session.totalItems > 0 ? Math.round((session.answeredCount / session.totalItems) * 100) : 0)}%`,
          }}
        />
      </div>

      <div
        className={`flex min-h-[220px] flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-card p-8 text-center shadow-sm ${reducedMotion ? "" : "transition-transform duration-300"}`}
        data-testid="swipe-card"
      >
        <p className="text-xl font-semibold text-foreground">{readStem(card)}</p>
        {isFlashcard && revealed ? (
          <div className="w-full border-t border-border pt-4" data-testid="flashcard-back">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Answer
            </p>
            <p className="mt-1 text-base leading-relaxed text-foreground/90">
              {card.explanation ?? "No explanation was added for this card."}
            </p>
          </div>
        ) : null}
      </div>

      {!feedback && card && card.rendererKey === "choice" ? (
        <ChoiceCard
          options={card.options}
          disabled={submitting || completing}
          onSubmit={(selectedOptionId) => {
            void submitResponse({ selectedOptionId });
          }}
        />
      ) : !feedback && card && card.itemTypeKey === "matching" ? (
        <MatchCard
          leftItems={card.leftItems}
          rightItems={card.rightItems}
          disabled={submitting || completing}
          onSubmit={(pairs) => {
            void submitResponse({ pairs });
          }}
        />
      ) : isFlashcard && !revealed && !feedback ? (
        <div className="flex justify-center">
          <button
            type="button"
            className="inline-flex min-w-[180px] items-center justify-center rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60 motion-safe:active:scale-95"
            disabled={!card}
            data-testid="flashcard-reveal-button"
            onClick={() => {
              setRevealed(true);
            }}
          >
            Show answer
          </button>
        </div>
      ) : feedback ? (
        <div
          className="rounded-2xl border border-border bg-muted p-4 text-center"
          role="status"
          data-testid="swipe-feedback"
        >
          <p className="font-bold text-foreground">{feedback.feedbackLabel}</p>
          {feedback.explanation ? (
            <p
              className="mx-auto mt-1 max-w-prose text-sm leading-relaxed text-foreground/90"
              data-testid="feedback-explanation"
            >
              {feedback.explanation}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Server-confirmed result for this card.</p>
          )}
          {reducedMotion ? (
            <button
              type="button"
              className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              onClick={() => {
                void advanceToNextCard(session, queuedNextCard);
              }}
            >
              Continue
            </button>
          ) : null}
        </div>
      ) : (
        <div className="flex justify-center gap-4">
          <button
            type="button"
            className="inline-flex min-w-[140px] items-center justify-center gap-2 rounded-xl border border-border bg-card px-6 py-3 text-sm font-bold text-foreground transition-all hover:border-[var(--destructive)] hover:text-[var(--destructive)] disabled:opacity-60 motion-safe:active:scale-95"
            disabled={submitting || completing || !card}
            data-testid="swipe-unknown-button"
            onClick={() => {
              void submitResponse({ action: "unknown" });
            }}
          >
            Still learning
          </button>
          <button
            type="button"
            className="inline-flex min-w-[140px] items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60 motion-safe:active:scale-95"
            disabled={submitting || completing || !card}
            data-testid="swipe-known-button"
            onClick={() => {
              void submitResponse({ action: "known" });
            }}
          >
            Got it
          </button>
        </div>
      )}

      {error ? (
        <p className="text-sm text-[var(--destructive)]" role="alert">
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
