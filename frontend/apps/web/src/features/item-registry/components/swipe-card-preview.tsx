"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";

const SWIPE_THRESHOLD_PX = 88;
const MAX_ROTATION_DEG = 18;
const FLY_OFF_MS = 420;
const SPRING_EASING = "cubic-bezier(0.34, 1.56, 0.64, 1)";
const EXIT_EASING = "cubic-bezier(0.4, 0, 0.2, 1)";

type SwipeCardPreviewProps = {
  stem: string;
  disabled?: boolean;
  resetToken?: number;
  onSwipe: (action: "known" | "unknown") => void;
};

type ExitSide = "left" | "right" | null;

function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setReduce(media.matches);
    };
    sync();
    media.addEventListener("change", sync);
    return () => {
      media.removeEventListener("change", sync);
    };
  }, []);

  return reduce;
}

function StackCard({
  depth,
  isPromoting,
}: {
  depth: 1 | 2;
  isPromoting: boolean;
}) {
  const scale = depth === 2 ? 0.88 : 0.94;
  const offsetY = depth === 2 ? 18 : 10;
  const opacity = depth === 2 ? 0.45 : 0.68;

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-x-0 top-0 h-full rounded-[24px] border border-[var(--admin-border)] bg-[var(--admin-surface-high)] shadow-[0_8px_24px_color-mix(in_srgb,var(--admin-on-surface)_8%,transparent)] motion-safe:transition-[transform,opacity] motion-safe:duration-300 ${
        isPromoting ? "motion-safe:scale-[0.97] motion-safe:opacity-80" : ""
      }`}
      style={{
        transform: `scale(${String(scale)}) translateY(${String(offsetY)}px)`,
        opacity,
        zIndex: depth,
      }}
    >
      <div className="absolute inset-0 rounded-[24px] bg-[linear-gradient(145deg,color-mix(in_srgb,var(--admin-surface)_88%,var(--admin-primary)_12%),var(--admin-surface-high))]" />
      <div className="absolute inset-x-6 top-8 h-2.5 rounded-full bg-[var(--admin-border)]" />
      <div className="absolute inset-x-6 top-14 h-2 rounded-full bg-[var(--admin-border)] opacity-70" />
      <div className="absolute inset-x-6 top-[4.5rem] h-2 rounded-full bg-[var(--admin-border)] opacity-50" />
    </div>
  );
}

export function SwipeCardPreview({
  stem,
  disabled = false,
  resetToken = 0,
  onSwipe,
}: SwipeCardPreviewProps) {
  const reduceMotion = usePrefersReducedMotion();
  const [offsetX, setOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [exitSide, setExitSide] = useState<ExitSide>(null);
  const [isSnapping, setIsSnapping] = useState(false);
  const [stackPromote, setStackPromote] = useState(false);
  const [actionPulse, setActionPulse] = useState<"known" | "unknown" | null>(null);
  const [readyForIdle, setReadyForIdle] = useState(false);

  const startXRef = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const exitTimerRef = useRef<number | null>(null);
  const idleTimerRef = useRef<number | null>(null);

  const maxRotation = reduceMotion ? 6 : MAX_ROTATION_DEG;
  const dragProgress = Math.min(1, Math.abs(offsetX) / SWIPE_THRESHOLD_PX);
  const rotation = (offsetX / SWIPE_THRESHOLD_PX) * maxRotation;
  const knownOpacity = offsetX > 0 ? dragProgress : 0;
  const unknownOpacity = offsetX < 0 ? dragProgress : 0;
  const knownScale = 0.72 + dragProgress * 0.28;
  const unknownScale = 0.72 + dragProgress * 0.28;
  const isInteractive = !disabled && exitSide === null;

  const clearExitTimer = useCallback(() => {
    if (exitTimerRef.current !== null) {
      window.clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
  }, []);

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current !== null) {
      window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const resetCard = useCallback(() => {
    clearExitTimer();
    clearIdleTimer();
    setOffsetX(0);
    setIsDragging(false);
    setExitSide(null);
    setIsSnapping(false);
    setStackPromote(false);
    setActionPulse(null);
    setReadyForIdle(false);
    idleTimerRef.current = window.setTimeout(() => {
      setReadyForIdle(true);
    }, 560);
  }, [clearExitTimer, clearIdleTimer]);

  useEffect(() => {
    resetCard();
  }, [resetToken, resetCard]);

  useEffect(() => {
    return () => {
      clearExitTimer();
      clearIdleTimer();
    };
  }, [clearExitTimer, clearIdleTimer]);

  const cardAnimationClass =
    isDragging || isSnapping || exitSide !== null
      ? ""
      : !readyForIdle
        ? "motion-safe:animate-[swipe-card-enter_0.55s_cubic-bezier(0.16,1,0.3,1)]"
        : "motion-safe:animate-[swipe-card-idle_3.2s_ease-in-out_infinite]";

  const flyOff = useCallback(
    (action: "known" | "unknown", direction: 1 | -1) => {
      if (!isInteractive) return;

      setActionPulse(action);
      setIsDragging(false);
      setIsSnapping(false);
      setStackPromote(true);
      setExitSide(direction === 1 ? "right" : "left");
      setOffsetX(direction * (reduceMotion ? 280 : 520));

      exitTimerRef.current = window.setTimeout(() => {
        onSwipe(action);
        resetCard();
      }, reduceMotion ? 180 : FLY_OFF_MS);
    },
    [isInteractive, onSwipe, reduceMotion, resetCard],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isInteractive) return;
      cardRef.current?.setPointerCapture(event.pointerId);
      startXRef.current = event.clientX - offsetX;
      setIsSnapping(false);
      setIsDragging(true);
    },
    [isInteractive, offsetX],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging || exitSide !== null) return;
      setOffsetX(event.clientX - startXRef.current);
    },
    [exitSide, isDragging],
  );

  const finishDrag = useCallback(() => {
    if (!isDragging || exitSide !== null) return;
    setIsDragging(false);

    if (offsetX > SWIPE_THRESHOLD_PX) {
      flyOff("known", 1);
      return;
    }
    if (offsetX < -SWIPE_THRESHOLD_PX) {
      flyOff("unknown", -1);
      return;
    }

    setIsSnapping(true);
    setOffsetX(0);
    window.setTimeout(() => {
      setIsSnapping(false);
    }, 520);
  }, [exitSide, flyOff, isDragging, offsetX]);

  const cardTransform = `translateX(${String(offsetX)}px) rotate(${String(rotation)}deg)`;

  const cardTransition =
    exitSide !== null
      ? `transform ${reduceMotion ? "0.18s" : "0.42s"} ${EXIT_EASING}, opacity ${reduceMotion ? "0.14s" : "0.32s"} ease-out`
      : isSnapping
        ? `transform 0.52s ${SPRING_EASING}`
        : isDragging
          ? "none"
          : "transform 0.2s ease-out";

  return (
    <div className="space-y-6">
      <p className="mx-auto max-w-sm text-center text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
        Drag the card. Swipe{" "}
        <span className="font-semibold text-[var(--admin-success)]">right</span> if you know it,{" "}
        <span className="font-semibold text-[var(--admin-danger)]">left</span> if you don&apos;t.
      </p>

      <div className="relative mx-auto w-full max-w-[340px] px-2">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-3 rounded-[32px] motion-safe:animate-[swipe-ambient-shift_5s_ease-in-out_infinite]"
          style={{
            background:
              "radial-gradient(ellipse at 18% 50%, color-mix(in srgb, var(--admin-danger) 16%, transparent), transparent 58%), radial-gradient(ellipse at 82% 50%, color-mix(in srgb, var(--admin-success) 16%, transparent), transparent 58%)",
          }}
        />

        <div className="relative h-[360px] select-none touch-none">
          <StackCard depth={2} isPromoting={stackPromote} />
          <StackCard depth={1} isPromoting={stackPromote} />

          <div
            className={`absolute inset-x-0 top-0 z-10 h-full ${cardAnimationClass}`}
            style={{
              opacity: exitSide !== null ? 0 : 1,
              transition:
                exitSide !== null
                  ? `opacity ${reduceMotion ? "0.14s" : "0.32s"} ease-out`
                  : undefined,
            }}
          >
            <div
              ref={cardRef}
              role="group"
              aria-label="Swipe card preview"
              aria-disabled={disabled}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={finishDrag}
              onPointerCancel={finishDrag}
              className={`relative flex h-full cursor-grab flex-col overflow-hidden rounded-[24px] border border-[color-mix(in_srgb,var(--admin-outline)_55%,var(--admin-border))] bg-[var(--admin-surface)] shadow-[0_20px_48px_color-mix(in_srgb,var(--admin-on-surface)_14%,transparent),inset_0_1px_0_color-mix(in_srgb,var(--admin-on-surface)_6%,transparent)] active:cursor-grabbing ${
                disabled ? "cursor-not-allowed opacity-60" : ""
              }`}
              style={{
                transform: cardTransform,
                transition: cardTransition,
              }}
            >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[linear-gradient(160deg,color-mix(in_srgb,var(--admin-surface)_92%,var(--admin-primary)_8%)_0%,var(--admin-surface)_45%,color-mix(in_srgb,var(--admin-surface-low)_88%,var(--admin-lesson-live)_12%)_100%)]"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--admin-on-surface)_5%,transparent),transparent)]"
            />

            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 transition-opacity duration-150"
              style={{
                opacity: knownOpacity * 0.55,
                background:
                  "radial-gradient(circle at 85% 22%, color-mix(in srgb, var(--admin-success) 28%, transparent), transparent 52%)",
              }}
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 transition-opacity duration-150"
              style={{
                opacity: unknownOpacity * 0.55,
                background:
                  "radial-gradient(circle at 15% 22%, color-mix(in srgb, var(--admin-danger) 28%, transparent), transparent 52%)",
              }}
            />

            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-5 top-7 origin-center rounded-md border-[3px] border-[var(--admin-danger)] px-3 py-1 text-[1.65rem] font-black uppercase leading-none tracking-[0.14em] text-[var(--admin-danger)] transition-[opacity,transform] duration-150"
              style={{
                opacity: unknownOpacity,
                transform: `rotate(-16deg) scale(${String(unknownScale)})`,
              }}
            >
              Unknown
            </div>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute right-5 top-7 origin-center rounded-md border-[3px] border-[var(--admin-success)] px-3 py-1 text-[1.65rem] font-black uppercase leading-none tracking-[0.14em] text-[var(--admin-success)] transition-[opacity,transform] duration-150"
              style={{
                opacity: knownOpacity,
                transform: `rotate(16deg) scale(${String(knownScale)})`,
              }}
            >
              Known
            </div>

            <div className="relative z-10 flex flex-1 flex-col px-6 pb-5 pt-6">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center rounded-full border border-[color-mix(in_srgb,var(--admin-lesson-live)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-lesson-live)_10%,var(--admin-surface))] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--admin-lesson-live)]">
                  Flashcard
                </span>
                <span className="text-[10px] font-medium text-[var(--admin-on-surface-variant)]">
                  {isDragging ? "Release to decide" : "Drag horizontally"}
                </span>
              </div>

              <div className="flex flex-1 items-center justify-center py-4">
                <p className="text-center text-[1.35rem] font-semibold leading-snug tracking-tight text-[var(--admin-on-surface)]">
                  {stem}
                </p>
              </div>

              <div className="flex items-center justify-center gap-5 pt-1">
                <span
                  className={`text-[11px] font-bold uppercase tracking-wide transition-opacity duration-150 ${
                    unknownOpacity > 0.35
                      ? "text-[var(--admin-danger)] opacity-100"
                      : "text-[var(--admin-on-surface-variant)] opacity-50"
                  }`}
                >
                  ← Don&apos;t know
                </span>
                <span className="h-1 w-1 rounded-full bg-[var(--admin-border)]" aria-hidden="true" />
                <span
                  className={`text-[11px] font-bold uppercase tracking-wide transition-opacity duration-150 ${
                    knownOpacity > 0.35
                      ? "text-[var(--admin-success)] opacity-100"
                      : "text-[var(--admin-on-surface-variant)] opacity-50"
                  }`}
                >
                  Know it →
                </span>
              </div>
            </div>
          </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-10 pt-1">
        <button
          type="button"
          disabled={!isInteractive}
          aria-label="Mark as unknown"
          onClick={() => {
            flyOff("unknown", -1);
          }}
          className={`group relative inline-flex h-[3.75rem] w-[3.75rem] items-center justify-center rounded-full border-2 border-[color-mix(in_srgb,var(--admin-danger)_45%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] text-[var(--admin-danger)] shadow-[0_10px_28px_color-mix(in_srgb,var(--admin-danger)_18%,transparent)] transition-[transform,box-shadow,background-color] duration-200 hover:bg-[color-mix(in_srgb,var(--admin-danger)_16%,var(--admin-surface))] hover:shadow-[0_14px_32px_color-mix(in_srgb,var(--admin-danger)_24%,transparent)] disabled:cursor-not-allowed disabled:opacity-45 motion-safe:hover:scale-105 motion-safe:active:scale-95 ${
            actionPulse === "unknown"
              ? "motion-safe:animate-[swipe-action-pop_0.35s_ease-out]"
              : ""
          }`}
        >
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-full bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          />
          <ThumbsDown className="relative h-6 w-6" strokeWidth={2.25} aria-hidden="true" />
        </button>

        <button
          type="button"
          disabled={!isInteractive}
          aria-label="Mark as known"
          onClick={() => {
            flyOff("known", 1);
          }}
          className={`group relative inline-flex h-[3.75rem] w-[3.75rem] items-center justify-center rounded-full border-2 border-[color-mix(in_srgb,var(--admin-success)_45%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_10%,var(--admin-surface))] text-[var(--admin-success)] shadow-[0_10px_28px_color-mix(in_srgb,var(--admin-success)_18%,transparent)] transition-[transform,box-shadow,background-color] duration-200 hover:bg-[color-mix(in_srgb,var(--admin-success)_16%,var(--admin-surface))] hover:shadow-[0_14px_32px_color-mix(in_srgb,var(--admin-success)_24%,transparent)] disabled:cursor-not-allowed disabled:opacity-45 motion-safe:hover:scale-105 motion-safe:active:scale-95 ${
            actionPulse === "known"
              ? "motion-safe:animate-[swipe-action-pop_0.35s_ease-out]"
              : ""
          }`}
        >
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-full bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          />
          <ThumbsUp className="relative h-6 w-6" strokeWidth={2.25} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
