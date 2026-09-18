"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { ClientApiError, clientApi } from "../../lib/client-api";

type RespondentOption = { id: string; label: string; sortOrder: number };

type RespondentPoll = {
  id: string;
  title: string;
  description: string | null;
  allowMultipleAnswers: boolean;
  anonymousVote: boolean;
  closesAt: string | null;
  options: RespondentOption[];
};

/**
 * Learner-facing poll voting.
 *
 * `POST /api/v1/polls/[id]/respond` has always been learner-permitted
 * (`enrollment.read`) but was unreachable: every poll *read* route sits behind
 * `membership.read` plus the analytics entitlement, so a learner could vote and
 * yet had no way to discover what the options were. This page pairs the respond
 * route with the respondent-scoped read added alongside it, which returns the
 * poll without `options[].isCorrect` — that field is the answer key for a
 * quizMode poll and must never reach the person answering.
 */
export function LearnerPollCard({ pollId }: { pollId: string }) {
  const [poll, setPoll] = useState<RespondentPoll | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedOptionId, setSelectedOptionId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [voted, setVoted] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await clientApi.get<{ data: RespondentPoll }>(
        `/api/v1/polls/${encodeURIComponent(pollId)}/respondent-view`,
      );
      setPoll(response.data);
    } catch (caught) {
      setLoadError(
        caught instanceof ClientApiError
          ? caught.message
          : "This poll is not open, or you are not enrolled.",
      );
    } finally {
      setLoading(false);
    }
  }, [pollId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleVote(event: React.SyntheticEvent) {
    event.preventDefault();
    if (!selectedOptionId) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      await clientApi.post(
        `/api/v1/polls/${encodeURIComponent(pollId)}/respond`,
        { pollOptionId: selectedOptionId },
        `poll-respond-${pollId}`,
        { successMessage: "Answer recorded." },
      );
      setVoted(true);
    } catch (caught) {
      setSubmitError(
        caught instanceof ClientApiError ? caught.message : "Could not record your answer.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--muted-foreground)]">Loading poll…</p>;
  }

  if (loadError !== null || poll === null) {
    return (
      <p className="text-sm text-[var(--muted-foreground)]">
        {loadError ?? "This poll is not available."}
      </p>
    );
  }

  if (voted) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <p className="flex items-center gap-2 text-sm font-medium text-foreground">
          <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
          Your answer has been recorded.
        </p>
        {poll.anonymousVote ? (
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            This poll is anonymous — your choice is not linked back to you.
          </p>
        ) : null}
      </div>
    );
  }

  const options = [...poll.options].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <form
      className="rounded-2xl border border-border bg-card p-6"
      onSubmit={(e) => void handleVote(e)}
    >
      <h1 className="text-xl font-semibold text-foreground">{poll.title}</h1>
      {poll.description === null ? null : (
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">{poll.description}</p>
      )}
      {poll.closesAt === null ? null : (
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
          Closes {new Date(poll.closesAt).toLocaleString()}
        </p>
      )}

      <fieldset className="mt-5">
        <legend className="sr-only">Choose an answer</legend>
        <div className="space-y-2">
          {options.map((option) => (
            <label
              key={option.id}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-4 py-3 text-sm text-foreground hover:bg-muted"
            >
              <input
                type="radio"
                name="poll-option"
                value={option.id}
                checked={selectedOptionId === option.id}
                onChange={() => {
                  setSelectedOptionId(option.id);
                }}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/*
        The API records one option per request, so multi-answer polls would need
        repeated calls. Rather than half-support that, the choice is single and
        the limitation is stated.
      */}
      {poll.allowMultipleAnswers ? (
        <p className="mt-3 text-xs text-[var(--muted-foreground)]">
          This poll accepts multiple answers; you can submit one at a time.
        </p>
      ) : null}

      {submitError === null ? null : (
        <p role="alert" className="mt-3 text-sm font-medium text-destructive">
          {submitError}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || selectedOptionId === ""}
        className="mt-5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {submitting ? "Submitting…" : "Submit answer"}
      </button>
    </form>
  );
}
