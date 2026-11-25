"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Eye, History, Loader2, RotateCcw, Undo2, X, XCircle } from "lucide-react";
import type { ItemImportHistoryEntry } from "@atlas/contracts/item-registry/item-import-api.contract";
import {
  ITEM_IMPORT_TYPE_NAMES,
  isImportableItemType,
} from "@atlas/contracts/item-registry/item-import.contract";
import { AdminConfirmDialog } from "../../../components/shells/admin/AdminConfirmDialog";
import { createClientUuid } from "../../../lib/api/client";
import {
  outlineButtonClassName,
  primaryButtonClassName,
} from "../../studio/courses/courses-catalog-shared";
import { listImportBatches, undoImportBatch } from "../api";
import { runBulkStatus } from "../bulk-status";
import { formatDateTime } from "../../../lib/format/academy-format";

const PAGE_SIZE = 20;
const CHANGED_EVENT = "atlas:item-import-changed";

/** Tells the history on this page that an import finished or changed. */
export function announceImportsChanged() {
  window.dispatchEvent(new Event(CHANGED_EVENT));
}

const cardClass =
  "space-y-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-sm";
const smallButtonClass = `${outlineButtonClassName} inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm disabled:cursor-wait disabled:opacity-60`;

const STATUS = {
  importing: {
    label: "Not finished",
    className:
      "bg-[color-mix(in_srgb,var(--admin-warning)_14%,var(--admin-surface))] text-[var(--admin-warning)]",
  },
  completed: {
    label: "Imported",
    className:
      "bg-[color-mix(in_srgb,var(--admin-success)_14%,var(--admin-surface))] text-[var(--admin-success)]",
  },
  undone: {
    label: "Undone",
    className: "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
  },
} as const;

function plural(count: number, one: string, many: string): string {
  return `${count.toLocaleString("en")} ${count === 1 ? one : many}`;
}

function typeName(key: string): string {
  return isImportableItemType(key) ? ITEM_IMPORT_TYPE_NAMES[key] : key;
}

function when(iso: string): string {
  return formatDateTime(new Date(iso), {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** What an undone import left behind, in plain words. */
export function undoneSummary(entry: { importedCount: number; liveCount: number }): string {
  const added = plural(entry.importedCount, "question", "questions");
  if (entry.liveCount === 0) {
    return `${added} added, all removed by the undo`;
  }
  return `${added} added, ${plural(entry.liveCount, "kept because it is in use", "kept because they are in use")}`;
}

type Notice = { tone: "success" | "error"; text: string };

/**
 * Every question import of the academy, newest first: what each added, what
 * is left of it, and (for the admin who ran it) publishing its drafts or
 * undoing it.
 */
export function ImportHistory() {
  const [entries, setEntries] = useState<ItemImportHistoryEntry[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState<{ id: string; done: number } | null>(null);
  const [undoing, setUndoing] = useState<ItemImportHistoryEntry | null>(null);
  const [undoBusy, setUndoBusy] = useState(false);
  const [undoError, setUndoError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const request = useRef(0);

  const load = useCallback(async (cursor: string | null) => {
    const id = ++request.current;
    setLoading(true);
    setLoadError(null);
    try {
      const page = await listImportBatches({
        limit: PAGE_SIZE,
        ...(cursor ? { cursor } : {}),
      });
      if (id !== request.current) return;
      setEntries((current) => (cursor && current ? [...current, ...page.data] : page.data));
      setNextCursor(page.page.nextCursor);
    } catch {
      if (id === request.current) setLoadError("The import history could not be loaded.");
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(null);
    const refresh = () => {
      void load(null);
    };
    window.addEventListener(CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener(CHANGED_EVENT, refresh);
    };
  }, [load]);

  async function publishDrafts(entry: ItemImportHistoryEntry) {
    setNotice(null);
    setPublishing({ id: entry.id, done: 0 });
    try {
      const outcome = await runBulkStatus(
        { status: "PUBLISHED", filter: { importBatchId: entry.id, status: "DRAFT" } },
        (done) => {
          setPublishing({ id: entry.id, done });
        },
      );
      setNotice({
        tone: "success",
        text: `${plural(outcome.updated, "question", "questions")} from ${entry.fileName} published.`,
      });
      await load(null);
    } catch {
      setNotice({
        tone: "error",
        text: "Not every question could be published. Try again; questions already published stay published.",
      });
    } finally {
      setPublishing(null);
    }
  }

  async function confirmUndo() {
    if (!undoing) return;
    setUndoBusy(true);
    setUndoError(null);
    try {
      const { data } = await undoImportBatch(undoing.id, `item-import-undo-${createClientUuid()}`);
      setNotice({
        tone: "success",
        text:
          `${plural(data.removed, "question", "questions")} removed from the item bank.` +
          (data.kept > 0
            ? ` ${plural(data.kept, "question stays", "questions stay")} because a deck, collection or assessment uses ${data.kept === 1 ? "it" : "them"}, or learners have answered ${data.kept === 1 ? "it" : "them"}.`
            : ""),
      });
      setUndoing(null);
      await load(null);
    } catch {
      setUndoError("The import could not be undone. Try again.");
    } finally {
      setUndoBusy(false);
    }
  }

  return (
    <section className={cardClass} aria-labelledby="import-history-heading">
      <div className="flex items-center gap-2">
        <History className="h-5 w-5 text-[var(--admin-on-surface-variant)]" aria-hidden="true" />
        <h2
          id="import-history-heading"
          className="text-base font-semibold text-[var(--admin-on-surface)]"
        >
          Import history
        </h2>
      </div>

      {notice ? (
        <div
          role="status"
          className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm text-[var(--admin-on-surface)] ${
            notice.tone === "success"
              ? "border-[color-mix(in_srgb,var(--admin-success)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_8%,var(--admin-surface))]"
              : "border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))]"
          }`}
        >
          {notice.tone === "success" ? (
            <CheckCircle2
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-success)]"
              aria-hidden="true"
            />
          ) : (
            <XCircle
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-danger)]"
              aria-hidden="true"
            />
          )}
          <p className="flex-1">{notice.text}</p>
          <button
            type="button"
            onClick={() => {
              setNotice(null);
            }}
            className="rounded p-0.5 text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-on-surface)]"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {loadError ? (
        <p role="alert" className="text-sm text-[var(--admin-danger)]">
          {loadError}{" "}
          <button
            type="button"
            onClick={() => {
              void load(null);
            }}
            className="font-semibold underline underline-offset-2"
          >
            Try again
          </button>
        </p>
      ) : null}

      {entries === null ? (
        <p className="flex items-center gap-2 text-sm text-[var(--admin-on-surface-variant)]">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading imports
        </p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-[var(--admin-on-surface-variant)]">
          No imports yet. Files you import appear here, so you can publish their questions or undo
          them.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--admin-border)] rounded-lg border border-[var(--admin-border)]">
          {entries.map((entry) => {
            const status = STATUS[entry.status];
            const drafts = entry.liveCount - entry.publishedCount;
            const busy = publishing?.id === entry.id;
            return (
              <li
                key={entry.id}
                className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold text-[var(--admin-on-surface)]">
                      {entry.fileName}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${status.className}`}
                    >
                      {status.label}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--admin-on-surface-variant)]">
                    {typeName(entry.itemTypeKey)} · {when(entry.createdAt)}
                    {entry.ownedByYou ? "" : " · by another author"}
                  </p>
                  <p className="text-xs text-[var(--admin-on-surface-variant)]">
                    {entry.status === "undone"
                      ? undoneSummary(entry)
                      : `${plural(entry.importedCount, "question", "questions")} added · ${entry.liveCount.toLocaleString("en")} in the bank · ${entry.publishedCount.toLocaleString("en")} published`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {entry.liveCount > 0 ? (
                    <Link
                      href={`/studio/items?batch=${encodeURIComponent(entry.id)}`}
                      className={smallButtonClass}
                    >
                      View questions
                    </Link>
                  ) : null}
                  {entry.ownedByYou && entry.status !== "undone" && drafts > 0 ? (
                    <button
                      type="button"
                      disabled={publishing !== null}
                      onClick={() => {
                        void publishDrafts(entry);
                      }}
                      className={`${primaryButtonClassName} px-3 py-1.5 text-sm disabled:cursor-wait disabled:opacity-60`}
                    >
                      {busy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {busy
                        ? `Publishing ${publishing.done.toLocaleString("en")}`
                        : "Publish drafts"}
                    </button>
                  ) : null}
                  {entry.ownedByYou && entry.status !== "undone" ? (
                    <button
                      type="button"
                      disabled={publishing !== null}
                      onClick={() => {
                        setUndoError(null);
                        setUndoing(entry);
                      }}
                      className={smallButtonClass}
                    >
                      <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Undo import
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {nextCursor ? (
        <button
          type="button"
          disabled={loading}
          onClick={() => {
            void load(nextCursor);
          }}
          className={smallButtonClass}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
          Show older imports
        </button>
      ) : null}

      <AdminConfirmDialog
        open={undoing !== null}
        title="Undo this import?"
        description={
          undoing ? (
            <span className="block space-y-2">
              <span className="block">
                {undoing.liveCount === 1
                  ? `The 1 question from ${undoing.fileName} that is still in the item bank is removed, even if it is published. Learners stop seeing it.`
                  : `The ${undoing.liveCount.toLocaleString("en")} questions from ${undoing.fileName} that are still in the item bank are removed, published ones too. Learners stop seeing them.`}
              </span>
              <span className="block">
                Any question a deck, collection or assessment already uses, or that learners have
                answered, stays, so no learner record loses its question. This cannot be reversed;
                to add the questions again, import the file again.
              </span>
            </span>
          ) : (
            ""
          )
        }
        confirmLabel="Undo import"
        busyLabel="Undoing"
        tone="danger"
        icon={RotateCcw}
        busy={undoBusy}
        error={undoError}
        onConfirm={() => {
          void confirmUndo();
        }}
        onCancel={() => {
          if (undoBusy) return;
          setUndoing(null);
        }}
      />
    </section>
  );
}
