"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  analyticsAlertErrorClassName,
  analyticsExportButtonClassName,
  analyticsTableHeadClassName,
  analyticsTableRowClassName,
  analyticsTableShellClassName,
  fieldClassName,
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { generalSettingsFormCardClassName } from "../general-settings/general-settings-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  createProgressGroup,
  createScoreGroup,
  dateInputToEndIso,
  dateInputToStartIso,
  exportProgressReport,
  exportScoreReport,
  fetchProgressLearners,
  fetchScoreLearners,
  fetchScoreQuizzes,
  PROGRESS_LEARNER_COLUMN_OPTIONS,
  SCORE_LEARNER_COLUMN_OPTIONS,
  sendProgressMessage,
  sendScoreMessage,
  type ProgressLearnerColumnKey,
  type ProgressLearnerItem,
  type ProgressProductItem,
  type ProgressProductType,
  type ScoreLearnerColumnKey,
  type ScoreLearnerItem,
  type ScoreProductType,
  type ScoreQuizItem,
} from "./admin-progress-score-roster-api";
import { downloadReportExport, pollReportRunUntilComplete } from "./admin-reports-api";
import { ProgressScoreReportTabs } from "./ProgressScoreReportTabs";
import { AdminProgressProductPicker } from "./AdminProgressProductPicker";
import { AdminScoresProductPicker } from "./AdminScoresProductPicker";
import type { ScoreLearnerResultStatus } from "./admin-progress-score-roster-api";

type MainTab = "progress" | "scores";
type ProgressProduct = ProgressProductType;
type ScoreProduct = "course_quiz" | "test_series" | "bundle" | "mock_test";

function scoreApiProductType(scoreProduct: ScoreProduct): ScoreProductType {
  return scoreProduct === "course_quiz" ? "course" : scoreProduct;
}

function scoreUiProduct(type: ScoreProductType): ScoreProduct {
  return type === "course" ? "course_quiz" : type;
}

const ENROLLED_TYPE_OPTIONS = [
  { value: "", label: "All types" },
  { value: "free", label: "Free" },
  { value: "paid", label: "Paid" },
  { value: "complimentary", label: "Complimentary" },
  { value: "manual", label: "Manual" },
  { value: "offline", label: "Offline" },
  { value: "trial", label: "Trial" },
] as const;

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function titleCase(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function AdminProgressScoreRosterPage({
  initialMainTab = "progress",
}: {
  initialMainTab?: MainTab;
}) {
  const router = useRouter();
  const [mainTab] = useState<MainTab>(initialMainTab);
  const [progressProduct, setProgressProduct] = useState<ProgressProduct>("course");
  const [scoreProduct, setScoreProduct] = useState<ScoreProduct>("course_quiz");

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [products] = useState<ProgressProductItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProgressProductItem | null>(null);
  const [quizzes, setQuizzes] = useState<ScoreQuizItem[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<ScoreQuizItem | null>(null);
  const [courseTitle, setCourseTitle] = useState("");
  const [quizTitle, setQuizTitle] = useState("");
  const [passMark, setPassMark] = useState<number | null>(null);

  const [learners, setLearners] = useState<ProgressLearnerItem[]>([]);
  const [scoreLearners, setScoreLearners] = useState<ScoreLearnerItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const [enrolledFrom, setEnrolledFrom] = useState("");
  const [enrolledTo, setEnrolledTo] = useState("");
  const [submittedFrom, setSubmittedFrom] = useState("");
  const [submittedTo, setSubmittedTo] = useState("");
  const [learnerName, setLearnerName] = useState("");
  const [enrolledType, setEnrolledType] = useState("");
  const [resultStatus, setResultStatus] = useState<"" | ScoreLearnerResultStatus>("");
  const [sortBy, setSortBy] = useState("enrolled_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [progressColumns, setProgressColumns] = useState<ProgressLearnerColumnKey[]>(
    PROGRESS_LEARNER_COLUMN_OPTIONS.map((column) => column.key),
  );
  const [scoreColumns, setScoreColumns] = useState<ScoreLearnerColumnKey[]>(
    SCORE_LEARNER_COLUMN_OPTIONS.map((column) => column.key),
  );

  const [groupTitle, setGroupTitle] = useState("");
  const [messageSubject, setMessageSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [actionsOpen, setActionsOpen] = useState(false);

  const loadProgressLearners = useCallback(async () => {
    if (!selectedProduct) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetchProgressLearners(progressProduct, selectedProduct.id, {
        enrolledFrom: dateInputToStartIso(enrolledFrom),
        enrolledTo: dateInputToEndIso(enrolledTo),
        learnerName: learnerName.trim() || undefined,
        enrolledType: enrolledType || undefined,
        sortBy,
        sortDir,
        columns: progressColumns,
        page,
      });
      setLearners(response.data.items);
      setCourseTitle(response.data.productTitle || response.data.courseTitle);
      setTotalCount(response.data.pageInfo.totalCount);
      setTotalPages(response.data.pageInfo.totalPages);
    } catch (loadError) {
      setError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Unable to load progress learners.",
      );
      setLearners([]);
    } finally {
      setLoading(false);
    }
  }, [
    enrolledFrom,
    enrolledTo,
    enrolledType,
    learnerName,
    page,
    progressColumns,
    progressProduct,
    selectedProduct,
    sortBy,
    sortDir,
  ]);

  const loadQuizzes = useCallback(async () => {
    if (!selectedProduct) return;
    setLoading(true);
    setError(null);
    try {
      const productType = scoreApiProductType(scoreProduct);
      const response = await fetchScoreQuizzes(productType, selectedProduct.id);
      setQuizzes(response.data.items);
      setCourseTitle(response.data.courseTitle);
      if (
        scoreProduct === "mock_test" &&
        response.data.items.length === 1 &&
        response.data.items[0]
      ) {
        setSelectedQuiz(response.data.items[0]);
      }
    } catch (loadError) {
      setError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Unable to load quizzes.",
      );
      setQuizzes([]);
    } finally {
      setLoading(false);
    }
  }, [scoreProduct, selectedProduct]);

  const loadScoreLearners = useCallback(async () => {
    if (!selectedQuiz) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetchScoreLearners(selectedQuiz.assessmentId, {
        ...(dateInputToStartIso(submittedFrom) !== undefined
          ? { submittedFrom: dateInputToStartIso(submittedFrom) }
          : {}),
        ...(dateInputToEndIso(submittedTo) !== undefined
          ? { submittedTo: dateInputToEndIso(submittedTo) }
          : {}),
        ...(learnerName.trim() ? { learnerName: learnerName.trim() } : {}),
        ...(resultStatus ? { resultStatus } : {}),
        sortBy: sortBy === "enrolled_at" ? "submitted_at" : sortBy,
        sortDir,
        columns: scoreColumns,
        page,
      });
      setScoreLearners(response.data.items);
      setQuizTitle(response.data.assessmentTitle);
      setPassMark(response.data.passMarkPercent);
      setTotalCount(response.data.pageInfo.totalCount);
      setTotalPages(response.data.pageInfo.totalPages);
    } catch (loadError) {
      setError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Unable to load quiz scores.",
      );
      setScoreLearners([]);
    } finally {
      setLoading(false);
    }
  }, [
    learnerName,
    page,
    resultStatus,
    scoreColumns,
    selectedQuiz,
    sortBy,
    sortDir,
    submittedFrom,
    submittedTo,
  ]);

  useEffect(() => {
    if (!selectedProduct) {
      return;
    }
    if (mainTab === "progress") {
      void loadProgressLearners();
      return;
    }
    if (!selectedQuiz) {
      void loadQuizzes();
      return;
    }
    void loadScoreLearners();
  }, [
    loadProgressLearners,
    loadQuizzes,
    loadScoreLearners,
    mainTab,
    selectedProduct,
    selectedQuiz,
  ]);

  function resetDrill() {
    setSelectedProduct(null);
    setSelectedQuiz(null);
    setLearners([]);
    setScoreLearners([]);
    setQuizzes([]);
    setPage(1);
    setActionsOpen(false);
  }

  async function handleExport() {
    if (!selectedProduct) return;
    setBusy(true);
    setError(null);
    try {
      const response =
        mainTab === "progress"
          ? await exportProgressReport({
              productType: progressProduct,
              productId: selectedProduct.id,
              courseId: progressProduct === "course" ? selectedProduct.id : undefined,
              enrolledFrom: dateInputToStartIso(enrolledFrom),
              enrolledTo: dateInputToEndIso(enrolledTo),
              learnerName: learnerName.trim() || undefined,
              enrolledType: enrolledType || undefined,
              columns: progressColumns,
              emailDownloadLink: true,
            })
          : await exportScoreReport({
              productType: scoreApiProductType(scoreProduct),
              productId: selectedProduct.id,
              courseId:
                scoreApiProductType(scoreProduct) === "course" ? selectedProduct.id : undefined,
              assessmentId: selectedQuiz?.assessmentId,
              submittedFrom: dateInputToStartIso(submittedFrom),
              submittedTo: dateInputToEndIso(submittedTo),
              learnerName: learnerName.trim() || undefined,
              resultStatus: resultStatus || undefined,
              columns: scoreColumns,
              emailDownloadLink: true,
            });
      const completed = await pollReportRunUntilComplete(response.data.runId);
      if (completed.status === "failed") {
        throw new Error(completed.errorMessage ?? "Export failed.");
      }
      if (completed.status === "completed") {
        await downloadReportExport(completed.id, "csv");
      }
    } catch (exportError) {
      setError(
        exportError instanceof ClientApiError
          ? exportError.message
          : exportError instanceof Error
            ? exportError.message
            : "Unable to export report.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateGroup() {
    if (!selectedProduct || !groupTitle.trim()) return;
    setBusy(true);
    setError(null);
    try {
      if (mainTab === "progress") {
        await createProgressGroup({
          productType: progressProduct,
          productId: selectedProduct.id,
          courseId: progressProduct === "course" ? selectedProduct.id : undefined,
          title: groupTitle.trim(),
          enrolledFrom: dateInputToStartIso(enrolledFrom),
          enrolledTo: dateInputToEndIso(enrolledTo),
          learnerName: learnerName.trim() || undefined,
          enrolledType: enrolledType || undefined,
        });
      } else if (selectedQuiz) {
        await createScoreGroup({
          assessmentId: selectedQuiz.assessmentId,
          title: groupTitle.trim(),
          submittedFrom: dateInputToStartIso(submittedFrom),
          submittedTo: dateInputToEndIso(submittedTo),
          learnerName: learnerName.trim() || undefined,
          resultStatus: resultStatus || undefined,
        });
      }
      setGroupTitle("");
    } catch (groupError) {
      setError(
        groupError instanceof ClientApiError
          ? groupError.message
          : groupError instanceof Error
            ? groupError.message
            : "Unable to create group.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleSendMessage() {
    if (!selectedProduct || !messageSubject.trim() || !messageBody.trim()) return;
    setBusy(true);
    setError(null);
    try {
      if (mainTab === "progress") {
        await sendProgressMessage({
          productType: progressProduct,
          productId: selectedProduct.id,
          courseId: progressProduct === "course" ? selectedProduct.id : undefined,
          subject: messageSubject.trim(),
          message: messageBody.trim(),
          enrolledFrom: dateInputToStartIso(enrolledFrom),
          enrolledTo: dateInputToEndIso(enrolledTo),
          learnerName: learnerName.trim() || undefined,
          enrolledType: enrolledType || undefined,
        });
      } else if (selectedQuiz) {
        await sendScoreMessage({
          assessmentId: selectedQuiz.assessmentId,
          subject: messageSubject.trim(),
          message: messageBody.trim(),
          submittedFrom: dateInputToStartIso(submittedFrom),
          submittedTo: dateInputToEndIso(submittedTo),
          learnerName: learnerName.trim() || undefined,
          resultStatus: resultStatus || undefined,
        });
      }
      setMessageSubject("");
      setMessageBody("");
    } catch (messageError) {
      setError(
        messageError instanceof ClientApiError
          ? messageError.message
          : messageError instanceof Error
            ? messageError.message
            : "Unable to send message.",
      );
    } finally {
      setBusy(false);
    }
  }

  const showLearnerRoster = selectedProduct && (mainTab === "progress" || Boolean(selectedQuiz));

  const productNoun =
    mainTab === "progress"
      ? progressProduct === "course"
        ? "courses"
        : progressProduct === "test_series"
          ? "test series"
          : progressProduct === "bundle"
            ? "bundles"
            : "subscriptions"
      : scoreProduct === "course_quiz"
        ? "courses"
        : scoreProduct === "test_series"
          ? "test series"
          : scoreProduct === "bundle"
            ? "bundles"
            : "mock tests";

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
      <ProgressScoreReportTabs active={mainTab} />

      {mainTab === "progress" && !selectedProduct ? (
        <AdminProgressProductPicker
          productType={progressProduct}
          onProductTypeChange={(type) => {
            setProgressProduct(type);
            resetDrill();
          }}
          onSelectProduct={(product) => {
            router.push(`/admin/reports/progress-score/progress/${progressProduct}/${product.id}`);
          }}
        />
      ) : mainTab === "scores" && !selectedProduct ? (
        <AdminScoresProductPicker
          productType={scoreApiProductType(scoreProduct)}
          onProductTypeChange={(type) => {
            setScoreProduct(scoreUiProduct(type));
            resetDrill();
          }}
          onSelectProduct={(product) => {
            router.push(
              `/admin/reports/progress-score/scores/${scoreApiProductType(scoreProduct)}/${product.id}`,
            );
          }}
        />
      ) : (
        <>
          <div>
            <h1 className="text-2xl font-semibold tracking-[-0.01em] text-[var(--admin-on-surface)]">
              {mainTab === "progress" ? "Progress" : "Scores"}
            </h1>
            <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
              {mainTab === "progress"
                ? "Learner-by-learner completion for the selected product."
                : "Pick an assessment to review attempt results."}
            </p>
          </div>

          {error ? <div className={analyticsAlertErrorClassName}>{error}</div> : null}

          {showLearnerRoster ? (
            <section className={generalSettingsFormCardClassName}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {mainTab === "progress"
                      ? courseTitle || selectedProduct.title
                      : `${quizTitle}${passMark != null ? ` · Pass mark ${String(passMark)}%` : ""}`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={ghostButtonClassName}
                    onClick={() => {
                      if (mainTab === "scores" && selectedQuiz && scoreProduct !== "mock_test") {
                        setSelectedQuiz(null);
                        setScoreLearners([]);
                        setPage(1);
                        return;
                      }
                      resetDrill();
                    }}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className={analyticsExportButtonClassName}
                    disabled={busy || loading}
                    onClick={() => void handleExport()}
                  >
                    Export CSV
                  </button>
                  <button
                    type="button"
                    className={ghostButtonClassName}
                    onClick={() => {
                      setActionsOpen((open) => !open);
                    }}
                  >
                    {actionsOpen ? "Hide actions" : "Create group / Message"}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-end gap-3">
                {mainTab === "progress" ? (
                  <>
                    <label className="grid gap-1 text-sm">
                      Enroll from
                      <input
                        type="date"
                        className={fieldClassName}
                        value={enrolledFrom}
                        onChange={(event) => {
                          setEnrolledFrom(event.target.value);
                          setPage(1);
                        }}
                      />
                    </label>
                    <label className="grid gap-1 text-sm">
                      Enroll to
                      <input
                        type="date"
                        className={fieldClassName}
                        value={enrolledTo}
                        onChange={(event) => {
                          setEnrolledTo(event.target.value);
                          setPage(1);
                        }}
                      />
                    </label>
                    <label className="grid gap-1 text-sm">
                      Enrollment type
                      <select
                        className={fieldClassName}
                        value={enrolledType}
                        onChange={(event) => {
                          setEnrolledType(event.target.value);
                          setPage(1);
                        }}
                      >
                        {ENROLLED_TYPE_OPTIONS.map((option) => (
                          <option key={option.value || "all"} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                ) : (
                  <>
                    <label className="grid gap-1 text-sm">
                      Submitted from
                      <input
                        type="date"
                        className={fieldClassName}
                        value={submittedFrom}
                        onChange={(event) => {
                          setSubmittedFrom(event.target.value);
                          setPage(1);
                        }}
                      />
                    </label>
                    <label className="grid gap-1 text-sm">
                      Submitted to
                      <input
                        type="date"
                        className={fieldClassName}
                        value={submittedTo}
                        onChange={(event) => {
                          setSubmittedTo(event.target.value);
                          setPage(1);
                        }}
                      />
                    </label>
                    <label className="grid gap-1 text-sm">
                      Result
                      <select
                        className={fieldClassName}
                        value={resultStatus}
                        onChange={(event) => {
                          setResultStatus(event.target.value as "" | ScoreLearnerResultStatus);
                          setPage(1);
                        }}
                      >
                        <option value="">All</option>
                        <option value="pass">Pass</option>
                        <option value="fail">Fail</option>
                        <option value="pending">Pending</option>
                        <option value="in_progress">In progress</option>
                      </select>
                    </label>
                  </>
                )}
                <label className="grid gap-1 text-sm">
                  Name
                  <input
                    className={fieldClassName}
                    value={learnerName}
                    placeholder="Filter by name"
                    onChange={(event) => {
                      setLearnerName(event.target.value);
                      setPage(1);
                    }}
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  Sort
                  <select
                    className={fieldClassName}
                    value={`${sortBy}:${sortDir}`}
                    onChange={(event) => {
                      const [nextSort, nextDir] = event.target.value.split(":") as [
                        string,
                        "asc" | "desc",
                      ];
                      setSortBy(nextSort);
                      setSortDir(nextDir);
                    }}
                  >
                    {mainTab === "progress" ? (
                      <>
                        <option value="enrolled_at:desc">Enrollment date ↓</option>
                        <option value="enrolled_at:asc">Enrollment date ↑</option>
                        <option value="expires_at:desc">Expiry date ↓</option>
                        <option value="expires_at:asc">Expiry date ↑</option>
                        <option value="completion_pct:desc">Completion % ↓</option>
                        <option value="completion_pct:asc">Completion % ↑</option>
                      </>
                    ) : (
                      <>
                        <option value="submitted_at:desc">Submitted on ↓</option>
                        <option value="submitted_at:asc">Submitted on ↑</option>
                        <option value="score_pct:desc">Score ↓</option>
                        <option value="score_pct:asc">Score ↑</option>
                        <option value="attempt_count:desc">Attempts ↓</option>
                        <option value="attempt_count:asc">Attempts ↑</option>
                      </>
                    )}
                  </select>
                </label>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {(mainTab === "progress"
                  ? PROGRESS_LEARNER_COLUMN_OPTIONS
                  : SCORE_LEARNER_COLUMN_OPTIONS
                ).map((column) => (
                  <label key={column.key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={
                        mainTab === "progress"
                          ? progressColumns.includes(column.key as ProgressLearnerColumnKey)
                          : scoreColumns.includes(column.key as ScoreLearnerColumnKey)
                      }
                      onChange={() => {
                        if (mainTab === "progress") {
                          const key = column.key as ProgressLearnerColumnKey;
                          setProgressColumns((current) =>
                            current.includes(key)
                              ? current.filter((item) => item !== key)
                              : [...current, key],
                          );
                          return;
                        }
                        const key = column.key as ScoreLearnerColumnKey;
                        setScoreColumns((current) =>
                          current.includes(key)
                            ? current.filter((item) => item !== key)
                            : [...current, key],
                        );
                      }}
                    />
                    {column.label}
                  </label>
                ))}
              </div>

              {actionsOpen ? (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="grid gap-2">
                    <input
                      className={fieldClassName}
                      placeholder="Group title"
                      value={groupTitle}
                      onChange={(event) => {
                        setGroupTitle(event.target.value);
                      }}
                    />
                    <button
                      type="button"
                      className={primaryButtonClassName}
                      disabled={busy || !groupTitle.trim()}
                      onClick={() => void handleCreateGroup()}
                    >
                      Create group
                    </button>
                  </div>
                  <div className="grid gap-2">
                    <input
                      className={fieldClassName}
                      placeholder="Message subject"
                      value={messageSubject}
                      onChange={(event) => {
                        setMessageSubject(event.target.value);
                      }}
                    />
                    <textarea
                      className={fieldClassName}
                      placeholder="Message body"
                      rows={3}
                      value={messageBody}
                      onChange={(event) => {
                        setMessageBody(event.target.value);
                      }}
                    />
                    <button
                      type="button"
                      className={primaryButtonClassName}
                      disabled={busy || !messageSubject.trim() || !messageBody.trim()}
                      onClick={() => void handleSendMessage()}
                    >
                      Send message
                    </button>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          <section className={analyticsTableShellClassName}>
            {loading ? (
              <p className="p-4 text-sm text-muted-foreground">Loading…</p>
            ) : !selectedProduct ? (
              <table className="w-full text-left text-sm">
                <thead className={analyticsTableHeadClassName}>
                  <tr>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Enrolled</th>
                    <th className="px-4 py-3">{mainTab === "scores" ? "Quizzes" : "Items"}</th>
                  </tr>
                </thead>
                <tbody>
                  {products.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-muted-foreground" colSpan={3}>
                        No {productNoun} found.
                      </td>
                    </tr>
                  ) : (
                    products.map((product) => (
                      <tr
                        key={product.id}
                        className={`${analyticsTableRowClassName} cursor-pointer`}
                        onClick={() => {
                          setSelectedProduct(product);
                          setPage(1);
                        }}
                      >
                        <td className="px-4 py-3">{product.title}</td>
                        <td className="px-4 py-3">{product.enrolledCount}</td>
                        <td className="px-4 py-3">{product.quizCount}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : mainTab === "scores" && !selectedQuiz ? (
              <table className="w-full text-left text-sm">
                <thead className={analyticsTableHeadClassName}>
                  <tr>
                    <th className="px-4 py-3">Quiz</th>
                    <th className="px-4 py-3">Lesson</th>
                    <th className="px-4 py-3">Learners</th>
                    <th className="px-4 py-3">Attempts</th>
                  </tr>
                </thead>
                <tbody>
                  {quizzes.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-muted-foreground" colSpan={4}>
                        No quizzes found for this product.
                      </td>
                    </tr>
                  ) : (
                    quizzes.map((quiz) => (
                      <tr
                        key={quiz.assessmentId}
                        className={`${analyticsTableRowClassName} cursor-pointer`}
                        onClick={() => {
                          setSelectedQuiz(quiz);
                          setSortBy("submitted_at");
                          setPage(1);
                        }}
                      >
                        <td className="px-4 py-3">{quiz.title}</td>
                        <td className="px-4 py-3">{quiz.lessonTitle ?? "—"}</td>
                        <td className="px-4 py-3">{quiz.learnerCount}</td>
                        <td className="px-4 py-3">{quiz.attemptCount}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : mainTab === "progress" ? (
              <table className="w-full text-left text-sm">
                <thead className={analyticsTableHeadClassName}>
                  <tr>
                    {progressColumns.includes("learner_name") ? (
                      <th className="px-4 py-3">Learner</th>
                    ) : null}
                    {progressColumns.includes("completion_pct") ? (
                      <th className="px-4 py-3">Completion</th>
                    ) : null}
                    {progressColumns.includes("enrolled_type") ? (
                      <th className="px-4 py-3">Type</th>
                    ) : null}
                    {progressColumns.includes("enrolled_at") ? (
                      <th className="px-4 py-3">Enrolled</th>
                    ) : null}
                    {progressColumns.includes("expires_at") ? (
                      <th className="px-4 py-3">Expires</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {learners.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-muted-foreground" colSpan={5}>
                        No learners matched the current filters.
                      </td>
                    </tr>
                  ) : (
                    learners.map((learner) => (
                      <tr
                        key={learner.enrollmentId}
                        className={`${analyticsTableRowClassName} cursor-pointer`}
                        onClick={() => {
                          router.push(
                            `/admin/reports/progress-score/progress/${progressProduct}/${learner.productId}/learners/${learner.enrollmentId}`,
                          );
                        }}
                      >
                        {progressColumns.includes("learner_name") ? (
                          <td className="px-4 py-3">
                            <Link
                              href={`/admin/reports/progress-score/progress/${progressProduct}/${learner.productId}/learners/${learner.enrollmentId}`}
                              className="underline"
                              onClick={(event) => {
                                event.stopPropagation();
                              }}
                            >
                              {learner.learnerName ?? learner.email ?? "Learner"}
                            </Link>
                          </td>
                        ) : null}
                        {progressColumns.includes("completion_pct") ? (
                          <td className="px-4 py-3">
                            {learner.completionPct}% ({learner.completedLessons}/
                            {learner.totalLessons})
                          </td>
                        ) : null}
                        {progressColumns.includes("enrolled_type") ? (
                          <td className="px-4 py-3">{titleCase(learner.enrolledType)}</td>
                        ) : null}
                        {progressColumns.includes("enrolled_at") ? (
                          <td className="px-4 py-3">{formatDate(learner.enrolledAt)}</td>
                        ) : null}
                        {progressColumns.includes("expires_at") ? (
                          <td className="px-4 py-3">{formatDate(learner.expiresAt)}</td>
                        ) : null}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className={analyticsTableHeadClassName}>
                  <tr>
                    {scoreColumns.includes("learner_name") ? (
                      <th className="px-4 py-3">Learner</th>
                    ) : null}
                    {scoreColumns.includes("result_status") ? (
                      <th className="px-4 py-3">Result</th>
                    ) : null}
                    {scoreColumns.includes("attempt_count") ? (
                      <th className="px-4 py-3">Attempts</th>
                    ) : null}
                    {scoreColumns.includes("score_pct") ? (
                      <th className="px-4 py-3">Score</th>
                    ) : null}
                    {scoreColumns.includes("answered_count") ? (
                      <th className="px-4 py-3">Answered</th>
                    ) : null}
                    {scoreColumns.includes("submitted_at") ? (
                      <th className="px-4 py-3">Submitted</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {scoreLearners.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-muted-foreground" colSpan={6}>
                        No quiz attempts matched the current filters.
                      </td>
                    </tr>
                  ) : (
                    scoreLearners.map((learner) => (
                      <tr
                        key={`${learner.membershipId}-${learner.latestAttemptId ?? "none"}`}
                        className={`${analyticsTableRowClassName} cursor-pointer`}
                        onClick={() => {
                          router.push(`/admin/members/${learner.membershipId}`);
                        }}
                      >
                        {scoreColumns.includes("learner_name") ? (
                          <td className="px-4 py-3">
                            {learner.learnerName ?? learner.email ?? "Learner"}
                          </td>
                        ) : null}
                        {scoreColumns.includes("result_status") ? (
                          <td className="px-4 py-3">{titleCase(learner.resultStatus)}</td>
                        ) : null}
                        {scoreColumns.includes("attempt_count") ? (
                          <td className="px-4 py-3">{learner.attemptCount}</td>
                        ) : null}
                        {scoreColumns.includes("score_pct") ? (
                          <td className="px-4 py-3">
                            {learner.scorePct == null ? "—" : `${learner.scorePct.toFixed(1)}%`}
                          </td>
                        ) : null}
                        {scoreColumns.includes("answered_count") ? (
                          <td className="px-4 py-3">{learner.answeredCount}</td>
                        ) : null}
                        {scoreColumns.includes("submitted_at") ? (
                          <td className="px-4 py-3">{formatDate(learner.submittedAt)}</td>
                        ) : null}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </section>

          {showLearnerRoster && totalPages > 1 ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages} · {totalCount} rows
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={ghostButtonClassName}
                  disabled={page <= 1 || loading}
                  onClick={() => {
                    setPage((current) => Math.max(1, current - 1));
                  }}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className={ghostButtonClassName}
                  disabled={page >= totalPages || loading}
                  onClick={() => {
                    setPage((current) => current + 1);
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
