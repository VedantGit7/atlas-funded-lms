"use client";

import Link from "next/link";
import { Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AdminConfirmDialog } from "../../../components/shells/admin/AdminConfirmDialog";
import {
  analyticsTableHeadClassName,
  analyticsTableRowClassName,
  analyticsTableShellClassName,
  fieldClassName,
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import {
  createPoll,
  deletePoll,
  fetchPoll,
  fetchPollResults,
  fetchPolls,
  updatePoll,
  type Poll,
  type PollResults,
} from "./admin-domain-api";
import { AdminDomainPageShell, adminDomainCardClassName } from "./admin-domain-shared";

export function AdminPollsPanel() {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [results, setResults] = useState<PollResults | null>(null);
  const [selectedPollId, setSelectedPollId] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingResults, setLoadingResults] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [title, setTitle] = useState("");
  const [optionsText, setOptionsText] = useState("Option A\nOption B");
  const [submitting, setSubmitting] = useState(false);
  const [editingPollId, setEditingPollId] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editStatus, setEditStatus] = useState("ACTIVE");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingPollId, setDeletingPollId] = useState("");
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchPolls();
      setPolls(response.data.items);
    } catch (loadError) {
      setError(loadError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(event: React.SyntheticEvent) {
    event.preventDefault();
    const options = optionsText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (!title.trim() || options.length === 0) return;

    setSubmitting(true);
    setError(null);
    try {
      await createPoll({
        title: title.trim(),
        options: options.map((label, index) => ({ label, sortOrder: index })),
      });
      setTitle("");
      setOptionsText("Option A\nOption B");
      await load();
    } catch (createError) {
      setError(createError);
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * Re-reads the poll before editing rather than trusting the list row.
   *
   * The list is a snapshot from whenever it last loaded; another admin may have
   * changed the poll since. Editing from a stale row would silently overwrite
   * their change with whatever the row happened to hold.
   */
  async function handleStartEdit(pollId: string) {
    setError(null);
    try {
      const response = await fetchPoll(pollId);
      setEditingPollId(pollId);
      setEditTitle(response.data.title);
      setEditStatus(response.data.status);
    } catch (editError) {
      setError(editError);
    }
  }

  async function handleSaveEdit(event: React.SyntheticEvent) {
    event.preventDefault();
    if (!editingPollId || !editTitle.trim()) return;

    setSavingEdit(true);
    setError(null);
    try {
      await updatePoll(editingPollId, { title: editTitle.trim(), status: editStatus });
      setEditingPollId("");
      await load();
    } catch (saveError) {
      setError(saveError);
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete(pollId: string) {
    setDeletingPollId(pollId);
    setError(null);
    try {
      await deletePoll(pollId);
      if (selectedPollId === pollId) {
        setSelectedPollId("");
        setResults(null);
      }
      if (editingPollId === pollId) setEditingPollId("");
      await load();
    } catch (deleteError) {
      setError(deleteError);
    } finally {
      setDeletingPollId("");
    }
  }

  async function handleViewResults(pollId: string) {
    setSelectedPollId(pollId);
    setLoadingResults(true);
    setError(null);
    try {
      const response = await fetchPollResults(pollId);
      setResults(response.data);
    } catch (resultsError) {
      setResults(null);
      setError(resultsError);
    } finally {
      setLoadingResults(false);
    }
  }

  return (
    <AdminDomainPageShell
      title="Polls"
      description="Create polls with options and review response counts."
      error={error}
    >
      <div className={adminDomainCardClassName}>
        <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">Create poll</h2>
        <form className="mt-4 space-y-3" onSubmit={(event) => void handleCreate(event)}>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-[var(--admin-on-surface-variant)]">
              Title
            </span>
            <input
              className={fieldClassName}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
              }}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-[var(--admin-on-surface-variant)]">
              Options (one per line)
            </span>
            <textarea
              className={`${fieldClassName} min-h-[96px]`}
              value={optionsText}
              onChange={(e) => {
                setOptionsText(e.target.value);
              }}
              required
            />
          </label>
          <button type="submit" className={primaryButtonClassName} disabled={submitting}>
            {submitting ? "Creating…" : "Create poll"}
          </button>
        </form>
      </div>

      <section className={adminDomainCardClassName}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">Polls</h2>
          <button
            type="button"
            className={ghostButtonClassName}
            disabled={loading}
            onClick={() => void load()}
          >
            Refresh
          </button>
        </div>
        {loading ? (
          <p className="mt-3 text-sm text-[var(--admin-on-surface-variant)]">Loading…</p>
        ) : polls.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--admin-on-surface-variant)]">No polls yet.</p>
        ) : (
          <div className={`${analyticsTableShellClassName} mt-4`}>
            <table className="min-w-full text-sm">
              <thead>
                <tr>
                  <th className={`${analyticsTableHeadClassName} px-4 py-3`}>Title</th>
                  <th className={`${analyticsTableHeadClassName} px-4 py-3`}>Options</th>
                  <th className={`${analyticsTableHeadClassName} px-4 py-3`}>Status</th>
                  <th className={`${analyticsTableHeadClassName} px-4 py-3`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {polls.map((poll) => (
                  <tr key={poll.id} className={analyticsTableRowClassName}>
                    <td className="px-4 py-3">{poll.title}</td>
                    <td className="px-4 py-3">{poll.options.length}</td>
                    <td className="px-4 py-3 capitalize">{poll.status.toLowerCase()}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={ghostButtonClassName}
                          onClick={() => void handleViewResults(poll.id)}
                        >
                          View results
                        </button>
                        <Link
                          href={`/polls/${poll.id}`}
                          className={ghostButtonClassName}
                          title="Open the poll exactly as an enrolled learner sees it"
                        >
                          Learner view
                        </Link>
                        <button
                          type="button"
                          className={ghostButtonClassName}
                          onClick={() => void handleStartEdit(poll.id)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className={ghostButtonClassName}
                          onClick={() => {
                            setPendingDelete({ id: poll.id, title: poll.title });
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editingPollId ? (
        <section className={adminDomainCardClassName}>
          <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">Edit poll</h2>
          <form className="mt-4 space-y-3" onSubmit={(event) => void handleSaveEdit(event)}>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-[var(--admin-on-surface-variant)]">
                Title
              </span>
              <input
                className={fieldClassName}
                value={editTitle}
                onChange={(e) => {
                  setEditTitle(e.target.value);
                }}
                required
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-[var(--admin-on-surface-variant)]">
                Status
              </span>
              <select
                className={fieldClassName}
                value={editStatus}
                onChange={(e) => {
                  setEditStatus(e.target.value);
                }}
              >
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Active</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="submit" className={primaryButtonClassName} disabled={savingEdit}>
                {savingEdit ? "Saving…" : "Save changes"}
              </button>
              <button
                type="button"
                className={ghostButtonClassName}
                onClick={() => {
                  setEditingPollId("");
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {selectedPollId ? (
        <section className={adminDomainCardClassName}>
          <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">Results</h2>
          {loadingResults ? (
            <p className="mt-3 text-sm text-[var(--admin-on-surface-variant)]">Loading results…</p>
          ) : results ? (
            <>
              <p className="mt-2 text-sm text-[var(--admin-on-surface-variant)]">
                Total responses: {results.totalResponses}
              </p>
              <ul className="mt-4 space-y-2">
                {results.options.map((option) => (
                  <li
                    key={option.optionId}
                    className="flex items-center justify-between rounded-lg border border-[var(--admin-border)] px-4 py-2 text-sm"
                  >
                    <span>{option.label}</span>
                    <span className="font-semibold tabular-nums">
                      {option.count}
                      {typeof option.percent === "number" ? ` (${option.percent.toFixed(1)}%)` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
      ) : null}

      <p className="text-sm text-[var(--admin-on-surface-variant)]">
        <Link
          href="/admin/reports/polls"
          className="font-semibold text-[var(--admin-primary)] hover:underline"
        >
          View polls report
        </Link>
      </p>

      <AdminConfirmDialog
        open={pendingDelete != null}
        title="Delete poll?"
        description={`Delete "${pendingDelete?.title ?? "this poll"}"? Responses collected so far are removed with it.`}
        confirmLabel="Delete poll"
        busyLabel="Deleting…"
        cancelLabel="Keep poll"
        icon={Trash2}
        tone="danger"
        busy={deletingPollId !== ""}
        onConfirm={() => {
          if (pendingDelete) {
            const { id } = pendingDelete;
            setPendingDelete(null);
            void handleDelete(id);
          }
        }}
        onCancel={() => {
          setPendingDelete(null);
        }}
      />
    </AdminDomainPageShell>
  );
}
