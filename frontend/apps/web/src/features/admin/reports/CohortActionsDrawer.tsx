"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowRight, Group, Mail, X } from "lucide-react";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { ClientApiError } from "../../../lib/client-api";
import { fetchBatchesRoster } from "./admin-batches-roster-api";
import {
  createProgressGroup,
  createScoreGroup,
  fetchProgressProducts,
  fetchScoreProducts,
  fetchScoreQuizzes,
  sendProgressMessage,
  sendScoreMessage,
  type ProgressProductType,
  type ScoreProductType,
} from "./admin-progress-score-roster-api";

const fieldClassName =
  "w-full rounded-sm border border-[var(--admin-on-surface)] bg-[var(--admin-surface-low)] px-4 py-3 text-sm text-[var(--admin-on-surface)] outline-none transition-colors placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[var(--admin-primary)]";

const labelClassName =
  "font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]";

export type CohortDrawerMode = "group" | "message";

export type CohortDrawerAudience =
  | {
      sourceKind: "progress";
      productType: ProgressProductType;
      productId: string;
      productTitle: string;
      matchCount: number;
      membershipIds?: string[];
      filterChips: string[];
      suggestedGroupName: string;
      audienceFilters?: Record<string, unknown>;
    }
  | {
      sourceKind: "scores";
      assessmentId: string;
      assessmentTitle: string;
      productTitle?: string | null;
      matchCount: number;
      membershipIds?: string[];
      filterChips: string[];
      suggestedGroupName: string;
      audienceFilters?: Record<string, unknown>;
    };

type Props = {
  open: boolean;
  initialMode?: CohortDrawerMode;
  audience: CohortDrawerAudience | null;
  onClose: () => void;
  onSuccess?: () => void;
};

const MERGE_TAGS = [
  { key: "{learner_name}", label: "Learner Name" },
  { key: "{product_title}", label: "Product Title" },
] as const;

function formatCount(n: number) {
  return new Intl.NumberFormat().format(n);
}

export function CohortActionsDrawer({
  open,
  initialMode = "group",
  audience,
  onClose,
  onSuccess,
}: Props) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<CohortDrawerMode>(initialMode);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [groupName, setGroupName] = useState("");
  const [description, setDescription] = useState("");
  const [alsoAddToBatchId, setAlsoAddToBatchId] = useState("");
  const [batches, setBatches] = useState<Array<{ id: string; name: string }>>([]);

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [excludeRecent, setExcludeRecent] = useState(true);
  const messageRef = useRef<HTMLTextAreaElement>(null);

  // Standalone source picking
  const [standaloneKind, setStandaloneKind] = useState<"progress" | "scores">("progress");
  const [productType, setProductType] = useState<ProgressProductType | ScoreProductType>("course");
  const [products, setProducts] = useState<Array<{ id: string; title: string }>>([]);
  const [productId, setProductId] = useState("");
  const [quizzes, setQuizzes] = useState<Array<{ id: string; title: string }>>([]);
  const [assessmentId, setAssessmentId] = useState("");
  const [standaloneCount, setStandaloneCount] = useState<number | null>(null);

  const effectiveAudience = useMemo((): CohortDrawerAudience | null => {
    if (audience) return audience;
    if (!productId) return null;
    if (standaloneKind === "progress") {
      const product = products.find((p) => p.id === productId);
      if (!product) return null;
      return {
        sourceKind: "progress",
        productType: productType as ProgressProductType,
        productId,
        productTitle: product.title,
        matchCount: standaloneCount ?? 0,
        filterChips: [`${productType.replace(/_/g, " ")}: ${product.title}`],
        suggestedGroupName: `Cohort — ${product.title}`,
      };
    }
    if (!assessmentId) return null;
    const quiz = quizzes.find((q) => q.id === assessmentId);
    if (!quiz) return null;
    return {
      sourceKind: "scores",
      assessmentId,
      assessmentTitle: quiz.title,
      productTitle: products.find((p) => p.id === productId)?.title ?? null,
      matchCount: standaloneCount ?? 0,
      filterChips: [`Assessment: ${quiz.title}`],
      suggestedGroupName: `Remediation — ${quiz.title}`,
    };
  }, [
    audience,
    assessmentId,
    productId,
    productType,
    products,
    quizzes,
    standaloneCount,
    standaloneKind,
  ]);

  const messageAudienceCount = useMemo(() => {
    if (!effectiveAudience) return 0;
    if (!excludeRecent) return effectiveAudience.matchCount;
    return Math.max(0, Math.floor(effectiveAudience.matchCount * 0.88));
  }, [effectiveAudience, excludeRecent]);

  useEffect(() => {
    if (!open) return;
    setMode(initialMode);
    setConfirming(false);
    setError(null);
    setGroupName(audience?.suggestedGroupName ?? "");
    setDescription("");
    setAlsoAddToBatchId("");
    setSubject("");
    setMessage("");
    setExcludeRecent(true);
  }, [open, initialMode, audience]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      try {
        const res = await fetchBatchesRoster({ page: 1 });
        setBatches(res.data.items.map((b) => ({ id: b.id, name: b.name })));
      } catch {
        setBatches([]);
      }
    })();
  }, [open]);

  useEffect(() => {
    if (!open || audience) return;
    void (async () => {
      try {
        if (standaloneKind === "progress") {
          const res = await fetchProgressProducts(productType as ProgressProductType, {
            page: 1,
            limit: 50,
          });
          setProducts(res.data.items.map((p) => ({ id: p.id, title: p.title })));
        } else {
          const res = await fetchScoreProducts(productType as ScoreProductType, {
            page: 1,
            limit: 50,
          });
          setProducts(res.data.items.map((p) => ({ id: p.id, title: p.title })));
        }
      } catch {
        setProducts([]);
      }
    })();
  }, [open, audience, standaloneKind, productType]);

  useEffect(() => {
    if (!open || audience || standaloneKind !== "scores" || !productId) {
      setQuizzes([]);
      return;
    }
    void (async () => {
      try {
        const res = await fetchScoreQuizzes(productType as ScoreProductType, productId, {
          page: 1,
          limit: 50,
        });
        setQuizzes(res.data.items.map((q) => ({ id: q.assessmentId, title: q.title })));
      } catch {
        setQuizzes([]);
      }
    })();
  }, [open, audience, standaloneKind, productType, productId]);

  useEffect(() => {
    if (!open || audience) return;
    if (standaloneKind === "progress" && productId) {
      setStandaloneCount(null);
      void (async () => {
        try {
          const { fetchProgressLearners } = await import("./admin-progress-score-roster-api");
          const res = await fetchProgressLearners(productType as ProgressProductType, productId, {
            page: 1,
            limit: 1,
          });
          setStandaloneCount(res.data.pageInfo.totalCount);
        } catch {
          setStandaloneCount(0);
        }
      })();
    } else if (standaloneKind === "scores" && assessmentId) {
      setStandaloneCount(null);
      void (async () => {
        try {
          const { fetchScoreLearners } = await import("./admin-progress-score-roster-api");
          const res = await fetchScoreLearners(assessmentId, { page: 1, limit: 1 });
          setStandaloneCount(res.data.pageInfo.totalCount);
        } catch {
          setStandaloneCount(0);
        }
      })();
    } else {
      setStandaloneCount(null);
    }
  }, [open, audience, standaloneKind, productType, productId, assessmentId]);

  useEffect(() => {
    if (!open || audience || !effectiveAudience) return;
    setGroupName(effectiveAudience.suggestedGroupName);
  }, [open, audience, effectiveAudience]);

  if (!open) return null;

  function insertTag(tag: string) {
    const el = messageRef.current;
    if (!el) {
      setMessage((prev) => `${prev}${tag}`);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = `${message.slice(0, start)}${tag}${message.slice(end)}`;
    setMessage(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + tag.length;
      el.setSelectionRange(pos, pos);
    });
  }

  async function submit() {
    if (!effectiveAudience) {
      setError("Select a product or assessment audience first.");
      return;
    }
    if (!confirming) {
      setConfirming(true);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      if (mode === "group") {
        if (!groupName.trim()) throw new Error("Group name is required.");
        if (effectiveAudience.sourceKind === "progress") {
          await createProgressGroup({
            productType: effectiveAudience.productType,
            productId: effectiveAudience.productId,
            ...(effectiveAudience.productType === "course"
              ? { courseId: effectiveAudience.productId }
              : {}),
            title: groupName.trim(),
            ...(description.trim() ? { description: description.trim() } : {}),
            ...(alsoAddToBatchId ? { alsoAddToBatchId } : {}),
            ...(effectiveAudience.membershipIds?.length
              ? { membershipIds: effectiveAudience.membershipIds }
              : {}),
            ...(effectiveAudience.audienceFilters ?? {}),
          });
        } else {
          await createScoreGroup({
            assessmentId: effectiveAudience.assessmentId,
            title: groupName.trim(),
            ...(description.trim() ? { description: description.trim() } : {}),
            ...(alsoAddToBatchId ? { alsoAddToBatchId } : {}),
            ...(effectiveAudience.membershipIds?.length
              ? { membershipIds: effectiveAudience.membershipIds }
              : {}),
            ...(effectiveAudience.audienceFilters ?? {}),
          });
        }
      } else {
        if (!subject.trim() || !message.trim()) {
          throw new Error("Subject and message are required.");
        }
        const caption =
          effectiveAudience.sourceKind === "progress"
            ? `${formatCount(effectiveAudience.matchCount)} learners · ${effectiveAudience.productTitle}`
            : `${formatCount(effectiveAudience.matchCount)} learners · ${effectiveAudience.assessmentTitle}`;
        if (effectiveAudience.sourceKind === "progress") {
          await sendProgressMessage({
            productType: effectiveAudience.productType,
            productId: effectiveAudience.productId,
            ...(effectiveAudience.productType === "course"
              ? { courseId: effectiveAudience.productId }
              : {}),
            subject: subject.trim(),
            message: message.trim(),
            audienceCaption: caption,
            ...(excludeRecent ? { excludeMessagedWithinDays: 7 } : {}),
            ...(effectiveAudience.membershipIds?.length
              ? { membershipIds: effectiveAudience.membershipIds }
              : {}),
            ...(effectiveAudience.audienceFilters ?? {}),
          });
        } else {
          await sendScoreMessage({
            assessmentId: effectiveAudience.assessmentId,
            subject: subject.trim(),
            message: message.trim(),
            audienceCaption: caption,
            ...(excludeRecent ? { excludeMessagedWithinDays: 7 } : {}),
            ...(effectiveAudience.membershipIds?.length
              ? { membershipIds: effectiveAudience.membershipIds }
              : {}),
            ...(effectiveAudience.audienceFilters ?? {}),
          });
        }
      }
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unable to complete cohort action.",
      );
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  const matchLabel = effectiveAudience
    ? `${formatCount(effectiveAudience.matchCount)} learners match the current filters`
    : "Select an audience";

  const primaryLabel =
    mode === "group"
      ? confirming
        ? `Confirm create · ${formatCount(effectiveAudience?.matchCount ?? 0)}`
        : `Create group with ${formatCount(effectiveAudience?.matchCount ?? 0)} learners`
      : confirming
        ? `Confirm send · ${formatCount(messageAudienceCount)}`
        : `Send to ${formatCount(messageAudienceCount)} learners`;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-[color-mix(in_srgb,var(--admin-on-surface)_55%,transparent)] transition-opacity"
        aria-label="Close cohort actions"
        onClick={onClose}
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex h-full w-full max-w-[560px] flex-col border-l border-[var(--admin-outline)] bg-[var(--admin-surface)] shadow-[-12px_0_40px_color-mix(in_srgb,var(--admin-on-surface)_12%,transparent)]"
      >
        <div className="relative shrink-0 border-b border-[var(--admin-outline)] bg-[var(--admin-surface-low)] px-8 py-6">
          <button
            type="button"
            className="absolute right-6 top-6 text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          <h2
            id={titleId}
            className="mb-2 pr-10 font-mono text-[18px] font-bold uppercase tracking-wide text-[var(--admin-on-surface)]"
          >
            {matchLabel}
          </h2>
          {effectiveAudience ? (
            <a
              href={
                effectiveAudience.sourceKind === "progress"
                  ? `/admin/reports/progress-score/progress/${effectiveAudience.productType}/${effectiveAudience.productId}`
                  : `/admin/reports/progress-score/scores/quizzes/${effectiveAudience.assessmentId}`
              }
              className="inline-flex items-center gap-1 text-sm text-[var(--admin-primary)] hover:underline"
            >
              View matched learners <ArrowRight className="h-4 w-4" />
            </a>
          ) : null}
          {effectiveAudience?.filterChips.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {effectiveAudience.filterChips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-3 py-1 font-mono text-[11px] text-[var(--admin-on-surface-variant)]"
                >
                  {chip}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 gap-4 border-b border-[var(--admin-outline)] bg-[var(--admin-surface)] px-8 py-4">
          {(
            [
              { key: "group" as const, label: "Create group", Icon: Group },
              { key: "message" as const, label: "Send message", Icon: Mail },
            ] as const
          ).map((tab) => {
            const active = mode === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                className={[
                  "relative flex-1 rounded-sm border px-4 py-3 font-mono text-[13px] uppercase tracking-wide transition-colors",
                  active
                    ? "border-[var(--admin-primary)] bg-[var(--admin-surface-high)] text-[var(--admin-primary)]"
                    : "border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)] hover:border-[var(--admin-outline)]",
                ].join(" ")}
                onClick={() => {
                  setMode(tab.key);
                  setConfirming(false);
                }}
              >
                <tab.Icon className="mr-2 inline h-4 w-4 align-middle" aria-hidden="true" />
                {tab.label}
                {active ? (
                  <span className="absolute bottom-0 left-0 h-0.5 w-full bg-[var(--admin-primary)]" />
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          {!audience ? (
            <div className="mb-8 flex flex-col gap-4 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-5">
              <p className={labelClassName}>Audience source</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  className={[
                    "flex-1 rounded-sm border px-3 py-2 font-mono text-[11px] uppercase",
                    standaloneKind === "progress"
                      ? "border-[var(--admin-primary)] text-[var(--admin-primary)]"
                      : "border-[var(--admin-border)] text-[var(--admin-on-surface-variant)]",
                  ].join(" ")}
                  onClick={() => {
                    setStandaloneKind("progress");
                    setProductId("");
                    setAssessmentId("");
                  }}
                >
                  Progress
                </button>
                <button
                  type="button"
                  className={[
                    "flex-1 rounded-sm border px-3 py-2 font-mono text-[11px] uppercase",
                    standaloneKind === "scores"
                      ? "border-[var(--admin-primary)] text-[var(--admin-primary)]"
                      : "border-[var(--admin-border)] text-[var(--admin-on-surface-variant)]",
                  ].join(" ")}
                  onClick={() => {
                    setStandaloneKind("scores");
                    setProductId("");
                    setAssessmentId("");
                  }}
                >
                  Scores
                </button>
              </div>
              <div className="grid gap-2">
                <label className={labelClassName} htmlFor="cohort-product-type">
                  Product type
                </label>
                <select
                  id="cohort-product-type"
                  className={fieldClassName}
                  value={productType}
                  onChange={(e) => {
                    setProductType(e.target.value as ProgressProductType);
                    setProductId("");
                    setAssessmentId("");
                  }}
                >
                  <option value="course">Course</option>
                  <option value="test_series">Test series</option>
                  <option value="bundle">Bundle</option>
                  {standaloneKind === "progress" ? (
                    <option value="subscription">Subscription</option>
                  ) : (
                    <option value="mock_test">Mock test</option>
                  )}
                </select>
              </div>
              <div className="grid gap-2">
                <label className={labelClassName} htmlFor="cohort-product">
                  Product
                </label>
                <select
                  id="cohort-product"
                  className={fieldClassName}
                  value={productId}
                  onChange={(e) => {
                    setProductId(e.target.value);
                    setAssessmentId("");
                  }}
                >
                  <option value="">Select product…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>
              {standaloneKind === "scores" ? (
                <div className="grid gap-2">
                  <label className={labelClassName} htmlFor="cohort-quiz">
                    Assessment
                  </label>
                  <select
                    id="cohort-quiz"
                    className={fieldClassName}
                    value={assessmentId}
                    onChange={(e) => setAssessmentId(e.target.value)}
                    disabled={!productId}
                  >
                    <option value="">Select assessment…</option>
                    {quizzes.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.title}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>
          ) : null}

          {mode === "group" ? (
            <div className="flex flex-col gap-8">
              <div className="flex flex-col gap-2">
                <label className={labelClassName} htmlFor="group-name">
                  Group Name
                </label>
                <input
                  id="group-name"
                  className={fieldClassName}
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className={labelClassName} htmlFor="group-desc">
                  Description (Optional)
                </label>
                <textarea
                  id="group-desc"
                  className={`${fieldClassName} resize-none`}
                  rows={3}
                  placeholder="Briefly describe the purpose of this group…"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-5">
                <h3 className="mb-4 font-mono text-[11px] uppercase tracking-widest text-[var(--admin-on-surface)]">
                  Group Membership Type
                </h3>
                <label className="flex cursor-pointer items-start gap-4">
                  <input type="radio" name="sync" className="mt-1 accent-[var(--admin-primary)]" checked readOnly />
                  <span>
                    <span className="block font-mono text-sm text-[var(--admin-on-surface)]">
                      Static snapshot
                    </span>
                    <span className="mt-1 block text-sm text-[var(--admin-on-surface-variant)]">
                      A fixed group of these specific learners. No automatic adds or removals.
                    </span>
                  </span>
                </label>
                <label className="mt-4 flex cursor-not-allowed items-start gap-4 opacity-50">
                  <input type="radio" name="sync" className="mt-1" disabled />
                  <span>
                    <span className="block font-mono text-sm text-[var(--admin-on-surface)]">
                      Live group (Dynamic)
                    </span>
                    <span className="mt-1 block text-sm text-[var(--admin-on-surface-variant)]">
                      Coming soon — daily refresh from saved filters is not wired yet.
                    </span>
                  </span>
                </label>
              </div>
              <div className="flex flex-col gap-2">
                <label className={labelClassName} htmlFor="batch-select">
                  Also add to a batch
                </label>
                <select
                  id="batch-select"
                  className={fieldClassName}
                  value={alsoAddToBatchId}
                  onChange={(e) => setAlsoAddToBatchId(e.target.value)}
                >
                  <option value="">Select a batch (Optional)…</option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-8">
              <div className="flex items-center justify-between rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-4">
                <div>
                  <div className={labelClassName}>Send to</div>
                  <div className="mt-1 font-mono text-[20px] text-[var(--admin-primary)]">
                    {formatCount(messageAudienceCount)} learners
                  </div>
                </div>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    className="accent-[var(--admin-primary)]"
                    checked={excludeRecent}
                    onChange={(e) => setExcludeRecent(e.target.checked)}
                  />
                  <span className="text-sm text-[var(--admin-on-surface-variant)]">
                    Exclude messaged in last 7 days
                  </span>
                </label>
              </div>
              <div className="flex gap-6">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked readOnly className="accent-[var(--admin-primary)]" />
                  <span className="font-mono text-sm text-[var(--admin-on-surface)]">Email</span>
                </label>
                <label className="flex cursor-not-allowed items-center gap-2 opacity-50">
                  <input type="checkbox" disabled />
                  <span className="font-mono text-sm text-[var(--admin-on-surface)]">
                    In-app Notification
                  </span>
                </label>
              </div>
              <div className="flex flex-col gap-2">
                <label className={labelClassName} htmlFor="msg-subject">
                  Subject
                </label>
                <input
                  id="msg-subject"
                  className={fieldClassName}
                  placeholder="Need help getting unstuck?"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <span className={labelClassName}>Message Body</span>
                <div className="overflow-hidden rounded-sm border border-[var(--admin-on-surface)] bg-[var(--admin-surface-low)] focus-within:border-[var(--admin-primary)] focus-within:ring-1 focus-within:ring-[var(--admin-primary)]">
                  <div className="flex flex-wrap gap-2 border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-2">
                    {MERGE_TAGS.map((tag) => (
                      <button
                        key={tag.key}
                        type="button"
                        className="rounded-sm px-2 py-1 font-mono text-[11px] text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface)] hover:text-[var(--admin-on-surface)]"
                        onClick={() => insertTag(tag.key)}
                      >
                        {tag.label}
                      </button>
                    ))}
                  </div>
                  <textarea
                    ref={messageRef}
                    className="min-h-[120px] w-full resize-y border-0 bg-transparent p-4 text-sm text-[var(--admin-on-surface)] outline-none"
                    placeholder="Type your message here…"
                    rows={6}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {MERGE_TAGS.map((tag) => (
                    <span
                      key={tag.key}
                      className="rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[var(--admin-on-surface-variant)]"
                    >
                      {tag.key}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {confirming ? (
            <p className="mt-6 rounded-sm border border-[var(--admin-warning)] bg-[color-mix(in_srgb,var(--admin-warning)_10%,transparent)] p-4 text-sm text-[var(--admin-on-surface)]">
              {mode === "group"
                ? `This will create a static group with ${formatCount(effectiveAudience?.matchCount ?? 0)} learners. Continue?`
                : `This will email ${formatCount(messageAudienceCount)} learners now. Sends cannot be undone.`}
            </p>
          ) : null}

          {error ? (
            <p className="mt-4 text-sm text-[var(--admin-danger)]" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center justify-between border-t border-[var(--admin-outline)] bg-[var(--admin-surface-low)] p-6">
          {confirming ? (
            <button
              type="button"
              className={`${ghostButtonClassName} underline`}
              onClick={() => setConfirming(false)}
              disabled={busy}
            >
              Back
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            className={primaryButtonClassName}
            disabled={busy || !effectiveAudience}
            onClick={() => void submit()}
          >
            {primaryLabel}
          </button>
        </div>
      </aside>
    </div>
  );
}
