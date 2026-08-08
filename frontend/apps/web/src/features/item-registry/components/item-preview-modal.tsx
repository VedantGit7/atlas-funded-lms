"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Eye,
  Info,
  RotateCcw,
  Sparkles,
  X,
  XCircle,
} from "lucide-react";
import {
  buildPreviewOptions,
  parseAnswerKeyText,
  readAnswerKeyExplanation,
  scorePreviewAnswer,
  supportsAutoCheck,
  isManualGradingType,
  type PreviewScoreResult,
} from "./item-preview-score";
import {
  catalogFilterButtonClassName,
  primaryButtonClassName,
} from "../../studio/courses/courses-catalog-shared";
import { getItemTypeVisual } from "./item-type-config";
import { ItemResponseRenderer } from "./renderers/item-response-renderer";

type ItemPreviewModalProps = {
  open: boolean;
  onClose: () => void;
  itemTypeKey: string;
  typeName: string;
  stem: string;
  answerKeyText: string;
  answerKeyJson?: Record<string, unknown>;
  savedOptions?: Array<{
    id: string;
    optionJson: unknown;
    isCorrect: boolean | null;
    position: number;
  }>;
};

function ExplanationPanel({ text }: { text: string }) {
  return (
    <div className="mt-3 rounded-xl border border-[color-mix(in_srgb,var(--admin-primary)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary-container)_18%,var(--admin-surface))] px-4 py-3 motion-safe:animate-[admin-banner-in_0.22s_ease-out]">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-primary)]">
        Why this is correct
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-[var(--admin-on-surface)]">{text}</p>
    </div>
  );
}

function FeedbackBanner({ result }: { result: PreviewScoreResult }) {
  const styles =
    result.kind === "correct"
      ? "border-[color-mix(in_srgb,var(--admin-success)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_12%,var(--admin-surface))] text-[var(--admin-success)]"
      : result.kind === "incorrect"
        ? "border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] text-[var(--admin-danger)]"
        : result.kind === "manual"
          ? "border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_12%,var(--admin-surface))] text-[var(--admin-warning)]"
          : "border-[var(--admin-border)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]";

  const Icon =
    result.kind === "correct"
      ? CheckCircle2
      : result.kind === "incorrect"
        ? XCircle
        : Info;

  return (
    <div className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 ${styles}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div>
        <p className="text-sm font-semibold">{result.title}</p>
        <p className="mt-0.5 text-sm leading-relaxed opacity-90">{result.detail}</p>
      </div>
    </div>
  );
}

export function ItemPreviewModal({
  open,
  onClose,
  itemTypeKey,
  typeName,
  stem,
  answerKeyText,
  answerKeyJson,
  savedOptions,
}: ItemPreviewModalProps) {
  const headingId = useId();
  const descriptionId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const [currentWire, setCurrentWire] = useState<Record<string, unknown> | null>(null);
  const [renderKey, setRenderKey] = useState(0);
  const [swipeResetToken, setSwipeResetToken] = useState(0);
  const [result, setResult] = useState<PreviewScoreResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const parsedAnswerKey = useMemo(() => {
    if (answerKeyJson) {
      return { ok: true as const, value: answerKeyJson };
    }
    return parseAnswerKeyText(answerKeyText);
  }, [answerKeyJson, answerKeyText]);

  const options = useMemo(
    () =>
      parsedAnswerKey.ok
        ? buildPreviewOptions(itemTypeKey, parsedAnswerKey.value, savedOptions)
        : [],
    [itemTypeKey, parsedAnswerKey, savedOptions],
  );

  const typeVisual = getItemTypeVisual(itemTypeKey);
  const TypeIcon = typeVisual.icon;
  const canAutoCheck = supportsAutoCheck(itemTypeKey);
  const isManual = isManualGradingType(itemTypeKey);
  const answerExplanation = parsedAnswerKey.ok ? readAnswerKeyExplanation(parsedAnswerKey.value) : "";

  function resetPreview() {
    setCurrentWire(null);
    setSwipeResetToken((current) => current + 1);
    setRenderKey((current) => current + 1);
    setResult(null);
    setParseError(null);
  }

  useEffect(() => {
    if (!open) return;
    resetPreview();
  }, [open, itemTypeKey]);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocused.current?.focus();
    };
  }, [open, onClose]);

  function handleCheck() {
    if (!parsedAnswerKey.ok) {
      setParseError("Fix the answer key before checking.");
      setResult(null);
      return;
    }

    setParseError(null);
    setResult(
      scorePreviewAnswer({
        itemTypeKey,
        answerKey: parsedAnswerKey.value,
        answerJson: currentWire,
        options,
      }),
    );
  }

  function handleAnswerChange(wire: Record<string, unknown> | null) {
    setCurrentWire(wire);
    setResult(null);

    if (itemTypeKey === "swipe" && wire && parsedAnswerKey.ok) {
      setResult(
        scorePreviewAnswer({
          itemTypeKey,
          answerKey: parsedAnswerKey.value,
          answerJson: wire,
          options,
        }),
      );
    }
  }

  if (!open) return null;

  return (
    <div className="admin-theme fixed inset-0 z-[75] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Close preview"
        tabIndex={-1}
        className="absolute inset-0 bg-[var(--admin-scrim)] backdrop-blur-sm motion-safe:animate-[admin-fade-in_0.15s_ease-out]"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        aria-describedby={descriptionId}
        className="relative flex max-h-[min(92dvh,820px)] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-2xl motion-safe:animate-[admin-dialog-in_0.22s_cubic-bezier(0.16,1,0.3,1)] sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-primary-container)_18%,var(--admin-surface))] px-5 py-4">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--admin-surface)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--admin-on-surface-variant)]">
                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                Learner preview
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${typeVisual.badgeClassName}`}
              >
                <TypeIcon className="h-3.5 w-3.5" aria-hidden="true" />
                {typeName}
              </span>
            </div>
            <h2 id={headingId} className="text-lg font-bold text-[var(--admin-on-surface)]">
              Preview as learner
            </h2>
            <p id={descriptionId} className="text-sm text-[var(--admin-on-surface-variant)]">
              Interact with the draft item locally. Nothing is saved or submitted to the server.
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            aria-label="Close preview"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <ItemResponseRenderer
            key={renderKey}
            itemTypeKey={itemTypeKey}
            stem={stem}
            answerKey={parsedAnswerKey.ok ? parsedAnswerKey.value : {}}
            {...(savedOptions ? { options: savedOptions } : {})}
            onAnswerChange={handleAnswerChange}
            mode="preview"
            swipeResetToken={swipeResetToken}
            showStem={itemTypeKey !== "swipe"}
          />

          {itemTypeKey === "swipe" && parsedAnswerKey.ok ? (
            <p className="mt-3 text-center text-xs text-[var(--admin-on-surface-variant)]">
              Answer key expects{" "}
              <span className="font-semibold text-[var(--admin-on-surface)]">
                {parsedAnswerKey.value["direction"] === "left" ? "Unknown (swipe left)" : "Known (swipe right)"}
              </span>
            </p>
          ) : null}

          {parseError ? (
            <p className="mt-4 text-sm text-[var(--admin-danger)]">{parseError}</p>
          ) : null}

          {result ? (
            <div className="mt-4 motion-safe:animate-[admin-banner-in_0.22s_ease-out]">
              <FeedbackBanner result={result} />
              {answerExplanation.trim() ? <ExplanationPanel text={answerExplanation.trim()} /> : null}
            </div>
          ) : null}

          {!parsedAnswerKey.ok ? (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-4 py-3 text-sm text-[var(--admin-on-surface-variant)]">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Fix the answer key in the editor to enable scoring feedback in preview.
            </div>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-[var(--admin-border)] bg-[var(--admin-surface)] px-5 py-4 sm:flex-row sm:justify-between">
          <button
            type="button"
            onClick={resetPreview}
            className={`${catalogFilterButtonClassName} inline-flex items-center justify-center gap-1.5 px-4 py-2.5 motion-safe:active:scale-[0.98]`}
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Reset
          </button>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onClose}
              className={`${catalogFilterButtonClassName} px-4 py-2.5 motion-safe:active:scale-[0.98]`}
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleCheck}
              disabled={!parsedAnswerKey.ok || (itemTypeKey === "swipe" && !currentWire)}
              className={`${primaryButtonClassName} px-5 py-2.5 motion-safe:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {isManual ? "Review grading flow" : canAutoCheck ? (itemTypeKey === "swipe" ? "Check swipe" : "Check answer") : "Validate preview"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
