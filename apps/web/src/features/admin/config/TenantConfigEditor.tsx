"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ClientApiError, clientApi } from "../../../lib/client-api";

type TenantConfigEditorProps = {
  initialConfigJson: Record<string, unknown>;
  canPublish: boolean;
};

function formatError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Request failed.";
}

export function TenantConfigEditor({ initialConfigJson, canPublish }: TenantConfigEditorProps) {
  const router = useRouter();
  const [draft, setDraft] = useState(JSON.stringify(initialConfigJson, null, 2));
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  async function saveDraft() {
    setBusy(true);
    setMessage(null);
    try {
      const configJson = JSON.parse(draft) as Record<string, unknown>;
      await clientApi.put("/api/v1/config", { configJson }, "config-update");
      setMessage("Configuration draft saved.");
      router.refresh();
    } catch (error) {
      setMessage(formatError(error));
    } finally {
      setBusy(false);
    }
  }

  async function publishConfig() {
    setBusy(true);
    setMessage(null);
    try {
      await clientApi.post("/api/v1/config/publish", {}, "config-publish");
      setConfirmPublish(false);
      setMessage("Configuration published.");
      router.refresh();
    } catch (error) {
      setMessage(formatError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4">
      <label className="block space-y-2">
        <span className="text-sm font-medium">Runtime configuration (JSON)</span>
        <textarea
          className="min-h-64 w-full rounded border p-3 font-mono text-sm"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          aria-label="Tenant configuration JSON editor"
        />
      </label>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="rounded border px-3 py-2"
          disabled={busy}
          onClick={() => {
            void saveDraft();
          }}
        >
          Save draft
        </button>
        {canPublish ? (
          <button
            type="button"
            className="rounded border px-3 py-2"
            disabled={busy}
            onClick={() => {
              setConfirmPublish(true);
            }}
          >
            Publish
          </button>
        ) : null}
      </div>

      {confirmPublish ? (
        <div role="dialog" aria-modal="true" className="rounded border bg-white p-4 shadow">
          <p>Publish this configuration version for the tenant?</p>
          <div className="mt-3 flex gap-2">
            <button
              ref={cancelRef}
              type="button"
              className="rounded border px-3 py-2"
              onClick={() => {
                setConfirmPublish(false);
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded border px-3 py-2"
              disabled={busy}
              onClick={() => {
                void publishConfig();
              }}
            >
              Confirm publish
            </button>
          </div>
        </div>
      ) : null}

      {message ? <p role="status">{message}</p> : null}
    </section>
  );
}
