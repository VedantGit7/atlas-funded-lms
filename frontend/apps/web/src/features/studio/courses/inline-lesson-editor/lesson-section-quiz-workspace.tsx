"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Clock,
  Library,
  PenLine,
  Trash2,
} from "lucide-react";
import type { z } from "zod";
import type {
  LessonQuiz,
  LessonQuizResponse,
  LessonQuizSettings,
} from "@atlas/contracts/lessons/lesson-quiz.schemas";
import type { studioLessonDetailSchema } from "@atlas/contracts/lessons/lesson-schemas";
import { ClientApiError, clientApi } from "../../../../lib/client-api";
import { itemDisplayTitle } from "../../../assessments/assessment-studio-shared";
import type { ItemDto } from "../../../item-registry/api";
import { QuestionComposerDialog } from "../../../item-registry/components/question-composer-dialog";
import {
  QuestionPickerDialog,
  questionTypeName,
} from "../../../item-registry/components/question-picker-dialog";
import {
  DEFAULT_QUIZ_SETTINGS,
  NEGATIVE_MARK_CHOICES,
  SHOW_ANSWERS_CHOICES,
  draftFingerprint,
  draftQuestionsFrom,
  marksSummary,
  negativeMarkingSummary,
  quizDraftProblem,
  quizLiveState,
  saveBody,
  type DraftQuestion,
} from "./lesson-quiz-model";

type StudioLessonDetail = z.infer<typeof studioLessonDetailSchema>;

type LessonSectionQuizWorkspaceProps = {
  lesson: StudioLessonDetail;
  editable: boolean;
};

const fieldBase =
  "rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-sm text-[var(--admin-on-surface)] focus:border-[var(--admin-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-60";

const fieldClassName = `${fieldBase} w-full`;

/** Number boxes keep their own width (fieldClassName's w-full would win). */
const numberFieldClassName = `${fieldBase} w-20 text-right tabular-nums`;

const buttonBase =
  "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/40 disabled:cursor-not-allowed disabled:opacity-50";

const primaryButton = `${buttonBase} bg-[var(--admin-primary)] text-[var(--admin-on-primary)] hover:bg-[var(--admin-primary-strong)]`;

const secondaryButton = `${buttonBase} border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]`;

const iconButton =
  "rounded-md p-1.5 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/40 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ClientApiError ? error.message : fallback;
}

function questionFromItem(item: ItemDto): DraftQuestion {
  return {
    itemId: item.id,
    itemTypeKey: item.itemTypeKey,
    contentJson: (item.contentJson ?? {}) as Record<string, unknown>,
    itemStatus: item.status,
    answered: false,
    points: "1",
  };
}

/**
 * The quiz of a course's quiz lesson, edited here (QA review 1 M26, review 2
 * 4.1; S3.4). It used to show placeholder zeros and a "Continue" button that
 * created a separate "<lesson> - Quiz" and left the course for Assessments,
 * where it needed its own review. Now the questions and settings are on this
 * screen, saved together, and the quiz goes live with the lesson.
 */
export function LessonSectionQuizWorkspace({ lesson, editable }: LessonSectionQuizWorkspaceProps) {
  const headingId = useId();
  const [loaded, setLoaded] = useState<LessonQuiz | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [settings, setSettings] = useState<LessonQuizSettings>(DEFAULT_QUIZ_SETTINGS);
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);
  const [savedFingerprint, setSavedFingerprint] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);

  const adopt = useCallback((quiz: LessonQuiz) => {
    const nextSettings = quiz.quiz?.settings ?? DEFAULT_QUIZ_SETTINGS;
    const nextQuestions = draftQuestionsFrom(quiz.quiz);
    setLoaded(quiz);
    setSettings(nextSettings);
    setQuestions(nextQuestions);
    setSavedFingerprint(draftFingerprint(nextSettings, nextQuestions));
  }, []);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const response = await clientApi.get<LessonQuizResponse>(`/api/v1/lessons/${lesson.id}/quiz`);
      adopt(response.data);
    } catch (err) {
      setLoadError(errorMessage(err, "The quiz couldn't be loaded."));
    }
  }, [adopt, lesson.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const canEdit = editable && (loaded?.editable ?? false);
  const dirty = loaded != null && draftFingerprint(settings, questions) !== savedFingerprint;
  const problem = quizDraftProblem(settings, questions);
  const addedIds = useMemo(
    () => new Set(questions.map((question) => question.itemId)),
    [questions],
  );
  const live = quizLiveState({
    lessonLive: loaded?.lessonLive ?? false,
    quizStatus: loaded?.quiz?.status ?? null,
    questionCount: questions.length,
  });

  // Leaving with unsaved changes asks first.
  useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [dirty]);

  function update(patch: Partial<LessonQuizSettings>) {
    setSettings((current) => ({ ...current, ...patch }));
    setNotice(null);
  }

  function editQuestions(next: (current: DraftQuestion[]) => DraftQuestion[]) {
    setQuestions(next);
    setNotice(null);
  }

  function move(index: number, by: -1 | 1) {
    editQuestions((current) => {
      const target = index + by;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      const [row] = next.splice(index, 1);
      if (row) next.splice(target, 0, row);
      return next;
    });
  }

  function addItems(items: ItemDto[]) {
    const fresh = items.filter((item) => !addedIds.has(item.id)).map(questionFromItem);
    editQuestions((current) => [...current, ...fresh]);
    setPickerOpen(false);
    if (fresh.length > 0) {
      setNotice(
        fresh.length === 1
          ? "Added 1 question. Save to keep it."
          : `Added ${String(fresh.length)} questions. Save to keep them.`,
      );
    }
  }

  async function save() {
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await clientApi.put<LessonQuizResponse>(
        `/api/v1/lessons/${lesson.id}/quiz`,
        saveBody(settings, questions),
        "lesson-quiz-save",
      );
      adopt(response.data);
      setNotice(
        response.data.quiz?.status === "PUBLISHED" && response.data.lessonLive
          ? "Saved. Learners get these changes now."
          : "Saved.",
      );
    } catch (err) {
      setError(errorMessage(err, "The quiz couldn't be saved. Try again."));
    } finally {
      setSaving(false);
    }
  }

  if (loadError) {
    return (
      <section className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-8 text-center">
        <p role="alert" className="text-sm text-[var(--admin-danger)]">
          {loadError}
        </p>
        <button
          type="button"
          className={`${secondaryButton} mt-4`}
          onClick={() => {
            void load();
          }}
        >
          Try again
        </button>
      </section>
    );
  }

  if (!loaded) {
    return (
      <section
        aria-busy="true"
        className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-8 text-sm text-[var(--admin-on-surface-variant)]"
      >
        Loading the quiz…
      </section>
    );
  }

  const asked = settings.questionsPerAttempt;
  const randomDraw = asked != null;
  const liveTone =
    live.tone === "live"
      ? "text-[var(--admin-success)]"
      : live.tone === "empty"
        ? "text-[var(--admin-warning)]"
        : "text-[var(--admin-on-surface-variant)]";
  const LiveIcon =
    live.tone === "live" ? CheckCircle2 : live.tone === "empty" ? AlertCircle : Clock;

  // Laid out on its own width, not the window's: the course editor puts it
  // between Studio's menu and the Sections panel.
  return (
    <div className="@container space-y-4">
      {/* What a learner faces, kept current as the quiz changes. */}
      <section
        aria-labelledby={headingId}
        className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-4 sm:px-5"
      >
        <div className="flex flex-col gap-3 @lg:flex-row @lg:items-start @lg:justify-between">
          <div className="min-w-0">
            <h2
              id={headingId}
              className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]"
            >
              Quiz
            </h2>
            <p className="mt-1 text-base font-semibold text-[var(--admin-on-surface)] sm:text-lg">
              {marksSummary(settings, questions)}
            </p>
            <p className={`mt-1.5 flex items-start gap-1.5 text-sm ${liveTone}`}>
              <LiveIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{live.text}</span>
            </p>
            {loaded.quiz && loaded.quiz.attemptCount > 0 ? (
              <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                {loaded.quiz.attemptCount} learner attempt
                {loaded.quiz.attemptCount === 1 ? "" : "s"} so far. Questions they&apos;ve answered
                stay in the quiz.
              </p>
            ) : null}
          </div>
          {canEdit ? (
            <div className="flex shrink-0 items-center gap-3">
              {dirty ? (
                <span className="text-xs font-medium text-[var(--admin-warning)]">
                  Unsaved changes
                </span>
              ) : null}
              <button
                type="button"
                className={primaryButton}
                disabled={saving || !dirty}
                onClick={() => {
                  void save();
                }}
              >
                {saving ? "Saving…" : "Save quiz"}
              </button>
            </div>
          ) : null}
        </div>
        {!canEdit ? (
          <p className="mt-3 text-sm text-[var(--admin-on-surface-variant)]">
            This course is in review or archived, so its quiz can&apos;t be changed now.
          </p>
        ) : null}
        {error ? (
          <p
            role="alert"
            className="mt-3 flex items-start gap-2 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-3 py-2 text-sm text-[var(--admin-danger)]"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
        ) : null}
        <p
          role="status"
          className="mt-2 text-sm text-[var(--admin-on-surface-variant)] empty:hidden"
        >
          {notice}
        </p>
      </section>

      <div className="grid gap-4 @4xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="@container/questions overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-border)] px-4 py-3 sm:px-5">
            <h3 className="text-sm font-semibold text-[var(--admin-on-surface)]">
              Questions{" "}
              <span className="font-normal text-[var(--admin-on-surface-variant)]">
                ({questions.length})
              </span>
            </h3>
            {canEdit ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={secondaryButton}
                  onClick={() => {
                    setComposerOpen(true);
                  }}
                >
                  <PenLine className="h-4 w-4" aria-hidden="true" />
                  Write a question
                </button>
                <button
                  type="button"
                  className={secondaryButton}
                  onClick={() => {
                    setPickerOpen(true);
                  }}
                >
                  <Library className="h-4 w-4" aria-hidden="true" />
                  Add from question bank
                </button>
              </div>
            ) : null}
          </div>

          {questions.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm font-medium text-[var(--admin-on-surface)]">
                This quiz has no questions yet.
              </p>
              <p className="mx-auto mt-1 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
                Write one here, or add questions from the question bank. To ask a random selection,
                add a pool (a whole tag or collection) and set &ldquo;Questions per attempt&rdquo;.
              </p>
            </div>
          ) : (
            <ol className="divide-y divide-[var(--admin-border)]">
              {questions.map((question, index) => {
                const marksId = `quiz-marks-${question.itemId}`;
                return (
                  <li
                    key={question.itemId}
                    className="flex flex-col gap-2 px-4 py-3 @lg/questions:flex-row @lg/questions:items-center @lg/questions:gap-3 @lg/questions:px-5"
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <span className="mt-0.5 w-6 shrink-0 text-right text-sm font-semibold tabular-nums text-[var(--admin-on-surface-variant)]">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm text-[var(--admin-on-surface)]">
                          {itemDisplayTitle(question.contentJson)}
                        </p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--admin-on-surface-variant)]">
                          <span className="rounded bg-[var(--admin-surface-high)] px-1.5 py-0.5 font-medium">
                            {questionTypeName(question.itemTypeKey)}
                          </span>
                          {question.answered ? <span>Answered by learners</span> : null}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-1 pl-9 @lg/questions:pl-0">
                      <label
                        htmlFor={marksId}
                        className="mr-1 text-xs text-[var(--admin-on-surface-variant)]"
                      >
                        Marks
                      </label>
                      <input
                        id={marksId}
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="any"
                        value={question.points}
                        disabled={!canEdit}
                        onChange={(event) => {
                          const value = event.target.value;
                          editQuestions((current) =>
                            current.map((row) =>
                              row.itemId === question.itemId ? { ...row, points: value } : row,
                            ),
                          );
                        }}
                        className={`${fieldBase} mr-2 w-16 py-1.5 text-right tabular-nums`}
                      />
                      {canEdit ? (
                        <>
                          <button
                            type="button"
                            className={iconButton}
                            aria-label={`Move question ${String(index + 1)} up`}
                            disabled={index === 0}
                            onClick={() => {
                              move(index, -1);
                            }}
                          >
                            <ArrowUp className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className={iconButton}
                            aria-label={`Move question ${String(index + 1)} down`}
                            disabled={index === questions.length - 1}
                            onClick={() => {
                              move(index, 1);
                            }}
                          >
                            <ArrowDown className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className={`${iconButton} hover:text-[var(--admin-danger)]`}
                            aria-label={
                              question.answered
                                ? `Question ${String(index + 1)} has been answered by learners, so it stays. Set its marks to 0 instead.`
                                : `Remove question ${String(index + 1)}`
                            }
                            title={
                              question.answered
                                ? "Learners have answered this question, so it stays. Set its marks to 0 instead."
                                : "Remove from this quiz"
                            }
                            disabled={question.answered}
                            onClick={() => {
                              editQuestions((current) =>
                                current.filter((row) => row.itemId !== question.itemId),
                              );
                            }}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <aside className="grid content-start gap-4 @2xl:grid-cols-2 @4xl:grid-cols-1">
          <section className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
            <h3 className="text-sm font-semibold text-[var(--admin-on-surface)]">Passing</h3>
            <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-3 text-sm">
              <label htmlFor="quiz-pass-mark" className="text-[var(--admin-on-surface)]">
                Pass mark (%)
              </label>
              <input
                id="quiz-pass-mark"
                type="number"
                min={0}
                max={100}
                value={settings.passMarkPercent}
                disabled={!canEdit}
                onChange={(event) => {
                  update({ passMarkPercent: Number(event.target.value) });
                }}
                className={numberFieldClassName}
              />
              <label htmlFor="quiz-attempts" className="text-[var(--admin-on-surface)]">
                Attempts allowed
              </label>
              <input
                id="quiz-attempts"
                type="number"
                min={1}
                max={100}
                value={settings.attemptsAllowed}
                disabled={!canEdit}
                onChange={(event) => {
                  update({ attemptsAllowed: Number(event.target.value) });
                }}
                className={numberFieldClassName}
              />
              <label htmlFor="quiz-time-limit" className="text-[var(--admin-on-surface)]">
                Time limit (minutes)
                <span className="block text-xs text-[var(--admin-on-surface-variant)]">
                  Empty for none
                </span>
              </label>
              <input
                id="quiz-time-limit"
                type="number"
                min={1}
                max={1440}
                placeholder="None"
                value={
                  settings.timeLimitSeconds != null
                    ? String(Math.round(settings.timeLimitSeconds / 60))
                    : ""
                }
                disabled={!canEdit}
                onChange={(event) => {
                  const minutes = event.target.value.trim();
                  update({
                    timeLimitSeconds: minutes ? Math.round(Number(minutes) * 60) : null,
                  });
                }}
                className={numberFieldClassName}
              />
            </div>
          </section>

          <section className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
            <fieldset>
              <legend className="text-sm font-semibold text-[var(--admin-on-surface)]">
                Questions per attempt
              </legend>
              <div className="mt-3 space-y-2 text-sm">
                <label className="flex items-center gap-2 text-[var(--admin-on-surface)]">
                  <input
                    type="radio"
                    name="quiz-questions-per-attempt"
                    checked={!randomDraw}
                    disabled={!canEdit}
                    onChange={() => {
                      update({ questionsPerAttempt: null });
                    }}
                    className="h-4 w-4 accent-[var(--admin-primary)]"
                  />
                  Every question
                </label>
                <label className="flex flex-wrap items-center gap-2 text-[var(--admin-on-surface)]">
                  <input
                    type="radio"
                    name="quiz-questions-per-attempt"
                    checked={randomDraw}
                    disabled={!canEdit}
                    onChange={() => {
                      update({
                        questionsPerAttempt: Math.max(
                          1,
                          Math.min(10, Math.max(1, questions.length - 1)),
                        ),
                      });
                    }}
                    className="h-4 w-4 accent-[var(--admin-primary)]"
                  />
                  A random
                  <input
                    type="number"
                    min={1}
                    aria-label="How many questions each attempt asks"
                    value={asked ?? ""}
                    disabled={!canEdit || !randomDraw}
                    onChange={(event) => {
                      const value = Math.floor(Number(event.target.value));
                      update({ questionsPerAttempt: value >= 1 ? value : 1 });
                    }}
                    className={`${fieldBase} w-16 py-1 text-right tabular-nums`}
                  />
                  of {questions.length}
                </label>
                <p className="text-xs text-[var(--admin-on-surface-variant)]">
                  {randomDraw
                    ? "Each attempt picks its questions at random from this quiz, so retakes differ."
                    : "Every attempt asks all the questions."}
                </p>
              </div>
            </fieldset>
          </section>

          <section className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
            <label
              htmlFor="quiz-negative"
              className="text-sm font-semibold text-[var(--admin-on-surface)]"
            >
              Negative marking
            </label>
            <select
              id="quiz-negative"
              value={String(
                NEGATIVE_MARK_CHOICES.find(
                  (choice) => Math.abs(choice.value - settings.negativeMarkPercent) < 0.01,
                )?.value ?? settings.negativeMarkPercent,
              )}
              disabled={!canEdit}
              onChange={(event) => {
                update({ negativeMarkPercent: Number(event.target.value) });
              }}
              className={`${fieldClassName} mt-2`}
            >
              {NEGATIVE_MARK_CHOICES.map((choice) => (
                <option key={choice.value} value={String(choice.value)}>
                  {choice.label}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">
              {negativeMarkingSummary(settings.negativeMarkPercent)} Only questions marked
              automatically lose marks, and the total never goes below zero.
            </p>
          </section>

          <section className="space-y-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 text-sm">
            <div>
              <label
                htmlFor="quiz-show-answers"
                className="font-semibold text-[var(--admin-on-surface)]"
              >
                Show learners the answers
              </label>
              <select
                id="quiz-show-answers"
                value={settings.showAnswersPolicy}
                disabled={!canEdit}
                onChange={(event) => {
                  update({
                    showAnswersPolicy: event.target
                      .value as LessonQuizSettings["showAnswersPolicy"],
                  });
                }}
                className={`${fieldClassName} mt-2`}
              >
                {SHOW_ANSWERS_CHOICES.map((choice) => (
                  <option key={choice.value} value={choice.value}>
                    {choice.label}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center justify-between gap-3 text-[var(--admin-on-surface)]">
              Shuffle the question order
              <input
                type="checkbox"
                checked={settings.shuffleItems}
                disabled={!canEdit}
                onChange={(event) => {
                  update({ shuffleItems: event.target.checked });
                }}
                className="h-4 w-4 accent-[var(--admin-primary)]"
              />
            </label>
            <label className="flex items-center justify-between gap-3 text-[var(--admin-on-surface)]">
              Shuffle the answer choices
              <input
                type="checkbox"
                checked={settings.shuffleOptions}
                disabled={!canEdit}
                onChange={(event) => {
                  update({ shuffleOptions: event.target.checked });
                }}
                className="h-4 w-4 accent-[var(--admin-primary)]"
              />
            </label>
          </section>
        </aside>
      </div>

      <QuestionPickerDialog
        open={pickerOpen}
        title="Add questions from the question bank"
        addedIds={addedIds}
        poolTools
        note="Questions can be drafts. Add a whole tag or collection to make a pool, then set how many each attempt asks."
        onCancel={() => {
          setPickerOpen(false);
        }}
        onConfirm={addItems}
      />
      <QuestionComposerDialog
        open={composerOpen}
        onCancel={() => {
          setComposerOpen(false);
        }}
        onCreated={(item) => {
          setComposerOpen(false);
          addItems([item]);
        }}
      />
    </div>
  );
}
