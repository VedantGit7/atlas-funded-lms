"use client";

import Link from "next/link";
import { useCallback, useMemo, useState, useTransition } from "react";
import {
  Activity,
  BookOpen,
  CalendarDays,
  Columns3,
  Layers,
  RotateCcw,
  Trash2,
} from "lucide-react";

import type {
  ContentTrashItem,
  ContentTrashKind,
  ContentTrashListResponse,
} from "@atlas/contracts/content-trash/content-trash.contract";
import { TRASH_RETENTION_DAYS } from "@atlas/contracts/content-trash/content-trash.contract";

import { clientApi, createClientUuid } from "../../../lib/client-api";

const TABS: Array<{ kind: ContentTrashKind; label: string; icon: typeof BookOpen }> = [
  { kind: "courses", label: "Courses", icon: BookOpen },
  { kind: "sections", label: "Sections", icon: Layers },
  { kind: "lessons", label: "Lessons", icon: Columns3 },
];

function TrashEmptyIllustration() {
  return (
    <svg
      viewBox="0 0 280 200"
      className="mx-auto h-40 w-auto text-[var(--admin-on-surface-variant)]"
      role="img"
      aria-label="Empty trash illustration"
    >
      <ellipse cx="140" cy="178" rx="88" ry="10" className="fill-[var(--admin-surface-high)]" />
      <path
        d="M108 72h64l10 88H98l10-88Z"
        className="fill-[var(--admin-surface-high)] stroke-[var(--admin-outline)]"
        strokeWidth="2"
      />
      <path
        d="M100 72h80"
        className="stroke-[var(--admin-on-surface-variant)]"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M124 72V58h32v14"
        className="stroke-[var(--admin-on-surface-variant)]"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="188" cy="118" r="28" className="fill-[var(--admin-primary)]/15" />
      <path
        d="M176 122c4 8 12 12 20 8"
        className="stroke-[var(--admin-primary)]"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="182" cy="110" r="2.5" className="fill-[var(--admin-primary)]" />
      <circle cx="198" cy="110" r="2.5" className="fill-[var(--admin-primary)]" />
      <rect
        x="168"
        y="88"
        width="22"
        height="16"
        rx="3"
        className="fill-[var(--admin-surface)] stroke-[var(--admin-border)]"
        strokeWidth="2"
      />
    </svg>
  );
}

function formatMovedOn(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function AdminTrashPanel({ initial }: { initial: ContentTrashListResponse["data"] }) {
  const [kind, setKind] = useState<ContentTrashKind>(initial.kind);
  const [itemsByKind, setItemsByKind] = useState<Record<ContentTrashKind, ContentTrashItem[]>>({
    courses: initial.kind === "courses" ? initial.items : [],
    sections: initial.kind === "sections" ? initial.items : [],
    lessons: initial.kind === "lessons" ? initial.items : [],
  });
  const [loaded, setLoaded] = useState<Record<ContentTrashKind, boolean>>({
    courses: initial.kind === "courses",
    sections: initial.kind === "sections",
    lessons: initial.kind === "lessons",
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const items = itemsByKind[kind];
  const retentionDays = initial.retentionDays || TRASH_RETENTION_DAYS;

  const loadKind = useCallback(async (next: ContentTrashKind) => {
    const response = await clientApi.get<ContentTrashListResponse>(
      `/api/v1/content-trash?kind=${next}`,
    );
    setItemsByKind((prev) => ({ ...prev, [next]: response.data.items }));
    setLoaded((prev) => ({ ...prev, [next]: true }));
  }, []);

  const selectTab = (next: ContentTrashKind) => {
    setKind(next);
    setError(null);
    if (loaded[next]) return;
    startTransition(async () => {
      try {
        await loadKind(next);
      } catch {
        setError("Could not load trash items. Try again.");
      }
    });
  };

  const runAction = async (action: "restore" | "purge", item: ContentTrashItem) => {
    setBusyId(item.id);
    setError(null);
    try {
      if (action === "restore") {
        await clientApi.post(
          "/api/v1/content-trash",
          { kind: item.kind, id: item.id },
          `trash-restore-${createClientUuid()}`,
        );
      } else {
        await clientApi.post(
          "/api/v1/content-trash/purge",
          { kind: item.kind, id: item.id },
          `trash-purge-${createClientUuid()}`,
        );
      }
      setItemsByKind((prev) => ({
        ...prev,
        [item.kind]: prev[item.kind].filter((row) => row.id !== item.id),
      }));
    } catch {
      setError(
        action === "restore" ? "Restore failed. Try again." : "Delete forever failed. Try again.",
      );
    } finally {
      setBusyId(null);
    }
  };

  const emptyCopy = useMemo(
    () => ({
      title: "Trash is empty",
      body: `Items moved to trash will be deleted forever after ${retentionDays} days.`,
    }),
    [retentionDays],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--admin-on-surface)] md:text-[1.75rem]">
            Trash
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
            Items you move to Trash are stored here. You can restore them within {retentionDays}{" "}
            days.
          </p>
        </div>
        <Link
          href="/admin/trash/activity"
          prefetch={false}
          className="inline-flex items-center gap-2 self-start rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3.5 py-2 text-sm font-semibold text-[var(--admin-on-surface)] transition-colors hover:border-[var(--admin-primary)] hover:bg-[var(--admin-surface-high)]"
        >
          <Activity className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          Activity Log
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[var(--admin-border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div role="tablist" aria-label="Trash content types" className="flex flex-wrap gap-1">
            {TABS.map((tab) => {
              const active = kind === tab.kind;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.kind}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    selectTab(tab.kind);
                  }}
                  className={[
                    "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold uppercase tracking-[0.06em] transition-colors",
                    active
                      ? "border-b-2 border-[var(--admin-primary)] text-[var(--admin-on-surface)]"
                      : "text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]",
                  ].join(" ")}
                >
                  <Icon className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[var(--admin-on-surface-variant)]">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-high)]/50 px-2.5 py-1.5 text-xs font-semibold">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
              Moved on
            </span>
          </div>
        </div>

        {error ? (
          <p
            role="alert"
            className="mx-4 mt-4 rounded-lg border border-[var(--admin-danger)]/40 bg-[var(--admin-danger)]/10 px-4 py-3 text-sm text-[var(--admin-danger)] sm:mx-6"
          >
            {error}
          </p>
        ) : null}

        <div className="min-h-[360px] px-4 py-8 sm:px-6">
          {pending && !loaded[kind] ? (
            <p className="py-16 text-center text-sm text-[var(--admin-on-surface-variant)]">
              Loading…
            </p>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center motion-safe:animate-[admin-dropdown-in_0.28s_cubic-bezier(0.16,1,0.3,1)]">
              <TrashEmptyIllustration />
              <p className="mt-4 text-lg font-bold text-[var(--admin-on-surface)]">
                {emptyCopy.title}
              </p>
              <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
                {emptyCopy.body}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--admin-border)]">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--admin-on-surface)]">
                      {item.title}
                    </p>
                    <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                      {item.subtitle ? `${item.subtitle} · ` : null}
                      Moved {formatMovedOn(item.deletedAt)}
                      {item.restoreEligible
                        ? ` · ${item.daysRemaining} day${item.daysRemaining === 1 ? "" : "s"} left`
                        : " · Expired"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busyId === item.id || !item.restoreEligible}
                      onClick={() => void runAction("restore", item)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--admin-on-surface)] transition-colors hover:border-[var(--admin-primary)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                      Restore
                    </button>
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => void runAction("purge", item)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--admin-danger)]/30 bg-[var(--admin-danger)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--admin-danger)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Delete forever
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
