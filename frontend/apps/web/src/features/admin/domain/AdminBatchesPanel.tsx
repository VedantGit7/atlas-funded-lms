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
  assignBatchMember,
  createBatch,
  deleteBatch,
  fetchBatch,
  fetchBatches,
  updateBatch,
  type Batch,
} from "./admin-domain-api";
import { AdminDomainPageShell, adminDomainCardClassName } from "./admin-domain-shared";

export function AdminBatchesPanel() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [assignBatchId, setAssignBatchId] = useState("");
  const [membershipId, setMembershipId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingBatchId, setEditingBatchId] = useState("");
  const [editName, setEditName] = useState("");
  const [editStatus, setEditStatus] = useState("ACTIVE");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingBatchId, setDeletingBatchId] = useState("");
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchBatches();
      setBatches(response.data.items);
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
    if (!key.trim() || !name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await createBatch({ key: key.trim(), name: name.trim() });
      setKey("");
      setName("");
      await load();
    } catch (createError) {
      setError(createError);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAssign(event: React.SyntheticEvent) {
    event.preventDefault();
    if (!assignBatchId || !membershipId.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await assignBatchMember(assignBatchId, membershipId.trim());
      setMembershipId("");
      await load();
    } catch (assignError) {
      setError(assignError);
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * Re-reads the batch before editing rather than trusting the list row, which
   * is a snapshot from whenever the table last loaded. Editing from a stale row
   * would overwrite a concurrent change with whatever that row happened to hold.
   */
  async function handleStartEdit(batchId: string) {
    setError(null);
    try {
      const response = await fetchBatch(batchId);
      setEditingBatchId(batchId);
      setEditName(response.data.name);
      setEditStatus(response.data.status);
    } catch (editError) {
      setError(editError);
    }
  }

  async function handleSaveEdit(event: React.SyntheticEvent) {
    event.preventDefault();
    if (!editingBatchId || !editName.trim()) return;

    setSavingEdit(true);
    setError(null);
    try {
      await updateBatch(editingBatchId, { name: editName.trim(), status: editStatus });
      setEditingBatchId("");
      await load();
    } catch (saveError) {
      setError(saveError);
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete(batchId: string) {
    setDeletingBatchId(batchId);
    setError(null);
    try {
      await deleteBatch(batchId);
      if (editingBatchId === batchId) setEditingBatchId("");
      if (assignBatchId === batchId) setAssignBatchId("");
      await load();
    } catch (deleteError) {
      setError(deleteError);
    } finally {
      setDeletingBatchId("");
    }
  }

  return (
    <AdminDomainPageShell
      title="Batches"
      description="Create learner batches and assign members by membership ID."
      error={error}
    >
      <div className={adminDomainCardClassName}>
        <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">Create batch</h2>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2"
          onSubmit={(event) => void handleCreate(event)}
        >
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-[var(--admin-on-surface-variant)]">
              Key
            </span>
            <input
              className={fieldClassName}
              value={key}
              onChange={(e) => {
                setKey(e.target.value);
              }}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-[var(--admin-on-surface-variant)]">
              Name
            </span>
            <input
              className={fieldClassName}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
              }}
              required
            />
          </label>
          <div className="sm:col-span-2">
            <button type="submit" className={primaryButtonClassName} disabled={submitting}>
              {submitting ? "Saving…" : "Create batch"}
            </button>
          </div>
        </form>
      </div>

      <div className={adminDomainCardClassName}>
        <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">Assign member</h2>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2"
          onSubmit={(event) => void handleAssign(event)}
        >
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-[var(--admin-on-surface-variant)]">
              Batch
            </span>
            <select
              className={fieldClassName}
              value={assignBatchId}
              onChange={(e) => {
                setAssignBatchId(e.target.value);
              }}
              required
            >
              <option value="">Select batch</option>
              {batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.name} ({batch.key})
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-[var(--admin-on-surface-variant)]">
              Membership ID
            </span>
            <input
              className={fieldClassName}
              value={membershipId}
              onChange={(e) => {
                setMembershipId(e.target.value);
              }}
              placeholder="UUID"
              required
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className={primaryButtonClassName}
              disabled={submitting || batches.length === 0}
            >
              Assign member
            </button>
          </div>
        </form>
      </div>

      <section className={adminDomainCardClassName}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">All batches</h2>
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
        ) : batches.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--admin-on-surface-variant)]">No batches yet.</p>
        ) : (
          <div className={`${analyticsTableShellClassName} mt-4`}>
            <table className="min-w-full text-sm">
              <thead>
                <tr>
                  <th className={`${analyticsTableHeadClassName} px-4 py-3`}>Key</th>
                  <th className={`${analyticsTableHeadClassName} px-4 py-3`}>Name</th>
                  <th className={`${analyticsTableHeadClassName} px-4 py-3`}>Status</th>
                  <th className={`${analyticsTableHeadClassName} px-4 py-3`}>Created</th>
                  <th className={`${analyticsTableHeadClassName} px-4 py-3`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((batch) => (
                  <tr key={batch.id} className={analyticsTableRowClassName}>
                    <td className="px-4 py-3 font-mono text-xs">{batch.key}</td>
                    <td className="px-4 py-3">{batch.name}</td>
                    <td className="px-4 py-3 capitalize">{batch.status.toLowerCase()}</td>
                    <td className="px-4 py-3">{new Date(batch.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={ghostButtonClassName}
                          onClick={() => void handleStartEdit(batch.id)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className={ghostButtonClassName}
                          onClick={() => {
                            setPendingDelete({ id: batch.id, name: batch.name });
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

      {editingBatchId ? (
        <section className={adminDomainCardClassName}>
          <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">Edit batch</h2>
          <form className="mt-4 space-y-3" onSubmit={(event) => void handleSaveEdit(event)}>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-[var(--admin-on-surface-variant)]">
                Name
              </span>
              <input
                className={fieldClassName}
                value={editName}
                onChange={(e) => {
                  setEditName(e.target.value);
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
                  setEditingBatchId("");
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <p className="text-sm text-[var(--admin-on-surface-variant)]">
        <Link
          href="/admin/reports/batches"
          className="font-semibold text-[var(--admin-primary)] hover:underline"
        >
          View batches report
        </Link>
      </p>

      <AdminConfirmDialog
        open={pendingDelete != null}
        title="Delete batch?"
        description={`Delete "${pendingDelete?.name ?? "this batch"}"? Members are unassigned from it.`}
        confirmLabel="Delete batch"
        busyLabel="Deleting…"
        cancelLabel="Keep batch"
        icon={Trash2}
        tone="danger"
        busy={deletingBatchId !== ""}
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
