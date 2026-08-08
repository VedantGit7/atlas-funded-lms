"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { BadgeCheck, Brain, Clock, ListChecks, Timer, X } from "lucide-react";
import { cn } from "@atlas/design-system";
import type { DiagnosticCatalogItem } from "@atlas/contracts-modules/diagnostics/diagnostic.types";
import { diagnosticApiClient } from "@atlas/contracts-modules/diagnostics/diagnostic.api-client";
import {
  catalogActionLabel,
  catalogIcon,
  catalogStatusMeta,
  formatDuration,
  formatQuestionCount,
} from "../diagnostics-view";

const EASE = [0.16, 1, 0.3, 1] as const;

type DiagnosticCatalogProps = {
  items: DiagnosticCatalogItem[];
};

export function DiagnosticCatalog({ items }: DiagnosticCatalogProps) {
  const [active, setActive] = useState<DiagnosticCatalogItem | null>(null);

  if (items.length === 0) {
    return <CatalogEmptyState />;
  }

  return (
    <>
      <ul className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {items.map((item, index) => (
          <li key={item.assessmentId}>
            <CatalogCard
              item={item}
              index={index}
              onOpen={() => {
                setActive(item);
              }}
            />
          </li>
        ))}
      </ul>

      <IntroModal
        item={active}
        onClose={() => {
          setActive(null);
        }}
      />
    </>
  );
}

function CatalogCard({
  item,
  index,
  onOpen,
}: {
  item: DiagnosticCatalogItem;
  index: number;
  onOpen: () => void;
}) {
  const Icon = catalogIcon(index);
  const status = catalogStatusMeta(item);
  const StatusIcon = status.icon;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex h-full w-full flex-col justify-between rounded-2xl border border-border bg-card p-6 text-left transition-colors duration-300 hover:border-[var(--ring)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <span
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-primary"
            aria-hidden="true"
          >
            <Icon className="h-6 w-6" strokeWidth={1.75} />
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider",
              status.chipClassName,
            )}
          >
            <StatusIcon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            {status.label}
          </span>
        </div>

        <h3 className="mt-5 text-xl font-semibold tracking-tight text-foreground">{item.title}</h3>
        {item.description ? (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
        ) : (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            An adaptive benchmark that maps your current competency themes.
          </p>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-border pt-4 text-xs font-medium text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          {formatDuration(item.estimatedMinutes)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <ListChecks className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          {formatQuestionCount(item.questionCount)}
        </span>
      </div>
    </button>
  );
}

function IntroModal({
  item,
  onClose,
}: {
  item: DiagnosticCatalogItem | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [error, setError] = useState<string | null>(null);

  const open = item != null;

  useEffect(() => {
    if (open) {
      setStatus("idle");
      setError(null);
      closeRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  const start = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const started = await diagnosticApiClient.startAuthenticatedDiagnostic();
      router.push(`/diagnostic/me/${started.data.sessionId}`);
    } catch (caught) {
      setStatus("idle");
      setError(caught instanceof Error ? caught.message : "Unable to start this assessment.");
    }
  }, [router]);

  const handlePrimary = useCallback(() => {
    if (!item) return;
    if (item.status === "in_progress" && item.sessionId) {
      router.push(`/diagnostic/me/${item.sessionId}`);
      return;
    }
    if (item.status === "completed" && item.sessionId) {
      router.push(`/diagnostic/me/${item.sessionId}/result`);
      return;
    }
    void start();
  }, [item, router, start]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[color-mix(in_srgb,var(--foreground)_45%,transparent)] p-5 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.25, ease: EASE }}
          onClick={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="diagnostic-intro-title"
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-2xl md:p-8"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 12 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: reduce ? 0 : 0.28, ease: EASE }}
          >
            <div
              className="pointer-events-none absolute -right-24 -top-24 h-48 w-48 rounded-full bg-[color-mix(in_srgb,var(--primary)_16%,transparent)] blur-3xl"
              aria-hidden="true"
            />
            <div className="relative">
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="absolute -right-2 -top-2 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              >
                <X className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
              </button>

              <h2
                id="diagnostic-intro-title"
                className="pr-8 text-2xl font-semibold tracking-tight text-foreground"
              >
                {item.title}
              </h2>

              <blockquote className="mt-5 rounded-r-xl border-l-4 border-primary bg-muted/60 p-4 text-sm italic leading-relaxed text-foreground">
                “Answer honestly — this maps your level, it isn&apos;t designed to trick you.”
              </blockquote>

              <dl className="mt-6 space-y-3">
                <IntroRow icon={Timer} label={`Duration: ${formatDuration(item.estimatedMinutes)}`} />
                <IntroRow icon={Brain} label="Focus: Your competency themes" />
                <IntroRow
                  icon={BadgeCheck}
                  label="Result: A skill snapshot and recommended next step"
                />
              </dl>

              {error ? (
                <p role="alert" className="mt-5 text-sm text-destructive">
                  {error}
                </p>
              ) : null}

              <button
                type="button"
                onClick={handlePrimary}
                disabled={status === "loading"}
                className="mt-6 flex w-full items-center justify-center rounded-xl bg-primary px-4 py-3.5 text-sm font-semibold uppercase tracking-widest text-primary-foreground transition-[filter,transform] hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {status === "loading" ? "Starting…" : catalogActionLabel(item.status)}
              </button>

              {item.status === "completed" ? (
                <button
                  type="button"
                  onClick={() => void start()}
                  disabled={status === "loading"}
                  className="mt-3 w-full text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
                >
                  Retake assessment
                </button>
              ) : (
                <p className="mt-4 text-center text-xs text-muted-foreground">
                  Once started, keep going until you submit.
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function IntroRow({ icon: Icon, label }: { icon: typeof Timer; label: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-muted-foreground">
      <Icon className="h-5 w-5 shrink-0 text-primary" strokeWidth={1.75} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

function CatalogEmptyState() {
  return (
    <section
      aria-label="Diagnostic assessments"
      className="rounded-2xl border border-border bg-card p-10 text-center"
    >
      <span
        className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground"
        aria-hidden="true"
      >
        <ListChecks className="h-7 w-7" strokeWidth={1.75} />
      </span>
      <h2 className="mt-5 text-xl font-semibold text-foreground">No diagnostics available yet</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        Your academy hasn&apos;t published a diagnostic assessment yet. Check back soon — new
        benchmarks appear here as they&apos;re released.
      </p>
    </section>
  );
}
