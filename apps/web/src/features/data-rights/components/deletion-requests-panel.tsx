"use client";

import { useRef, useState } from "react";
import {
  createDeletionRequest,
  fetchDeletionRequests,
  formatApiError,
  processDeletionRequest,
  type DeletionRequestItem,
} from "../api";

type DeletionRequestsPanelProps = {
  initialRequests: DeletionRequestItem[];
  canManage: boolean;
  canFileForOthers: boolean;
  defaultTargetMembershipId?: string;
};

export function DeletionRequestsPanel({
  initialRequests,
  canManage,
  canFileForOthers,
  defaultTargetMembershipId,
}: DeletionRequestsPanelProps) {
  const [requests, setRequests] = useState(initialRequests);
  const [confirmProcessId, setConfirmProcessId] = useState<string | null>(null);
  const [confirmFileOpen, setConfirmFileOpen] = useState(false);
  const [targetMembershipId, setTargetMembershipId] = useState(defaultTargetMembershipId ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  async function refreshRequests() {
    const response = await fetchDeletionRequests();
    setRequests(response.data.items);
  }

  async function fileRequest() {
    setBusy(true);
    setMessage(null);
    setRequestId(null);
    try {
      await createDeletionRequest(
        {
          confirm: true,
          ...(canFileForOthers && targetMembershipId ? { targetMembershipId } : {}),
        },
        `deletion-file-${String(Date.now())}`,
      );
      setConfirmFileOpen(false);
      await refreshRequests();
      setMessage("Deletion request filed.");
    } catch (error) {
      const formatted = formatApiError(error);
      setMessage(formatted.message);
      setRequestId(formatted.requestId);
    } finally {
      setBusy(false);
    }
  }

  async function confirmProcess(requestItemId: string) {
    setBusy(true);
    setMessage(null);
    setRequestId(null);
    try {
      await processDeletionRequest(requestItemId, `deletion-process-${requestItemId}`);
      setConfirmProcessId(null);
      await refreshRequests();
      setMessage("Deletion request processed.");
    } catch (error) {
      const formatted = formatApiError(error);
      setMessage(formatted.message);
      setRequestId(formatted.requestId);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Deletion requests</h2>
        {canFileForOthers ? (
          <button
            type="button"
            onClick={() => {
              setConfirmFileOpen(true);
            }}
          >
            File request
          </button>
        ) : null}
      </div>

      {message ? (
        <p role="alert" className="text-sm">
          {message}
          {requestId ? ` Request ID: ${requestId}` : ""}
        </p>
      ) : null}

      {requests.length === 0 ? (
        <p className="text-sm text-neutral-600">No deletion requests yet.</p>
      ) : (
        <div className="space-y-3">
          <table className="hidden w-full text-left text-sm md:table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Target</th>
                <th>Requested</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id}>
                  <td>{request.status}</td>
                  <td>
                    {request.targetType}:{request.targetId}
                  </td>
                  <td>{new Date(request.createdAt).toLocaleString()}</td>
                  <td>
                    {canManage && request.status === "QUEUED" ? (
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmProcessId(request.id);
                        }}
                      >
                        Process
                      </button>
                    ) : (
                      <span className="text-neutral-500">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="space-y-3 md:hidden">
            {requests.map((request) => (
              <article key={request.id} className="rounded border p-3">
                <p>
                  <strong>Status:</strong> {request.status}
                </p>
                <p>
                  <strong>Target:</strong> {request.targetType}:{request.targetId}
                </p>
                <p>
                  <strong>Requested:</strong> {new Date(request.createdAt).toLocaleString()}
                </p>
                {canManage && request.status === "QUEUED" ? (
                  <button
                    type="button"
                    className="mt-2"
                    onClick={() => {
                      setConfirmProcessId(request.id);
                    }}
                  >
                    Process
                  </button>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      )}

      {confirmFileOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md space-y-4 rounded bg-white p-6 shadow" role="dialog">
            <h3>File deletion request?</h3>
            {canFileForOthers ? (
              <label className="block text-sm">
                Target membership ID
                <input
                  className="mt-1 w-full border px-2 py-1"
                  value={targetMembershipId}
                  onChange={(event) => {
                    setTargetMembershipId(event.target.value);
                  }}
                />
              </label>
            ) : null}
            <div className="flex justify-end gap-2">
              <button
                ref={cancelRef}
                type="button"
                autoFocus
                onClick={() => {
                  setConfirmFileOpen(false);
                }}
                disabled={busy}
              >
                Cancel
              </button>
              <button type="button" onClick={() => void fileRequest()} disabled={busy}>
                {busy ? "Filing…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmProcessId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md space-y-4 rounded bg-white p-6 shadow" role="dialog">
            <h3>Process deletion request?</h3>
            <p>This action is irreversible.</p>
            <div className="flex justify-end gap-2">
              <button
                ref={cancelRef}
                type="button"
                autoFocus
                onClick={() => {
                  setConfirmProcessId(null);
                }}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmProcess(confirmProcessId)}
                disabled={busy}
              >
                {busy ? "Processing…" : "Confirm process"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
