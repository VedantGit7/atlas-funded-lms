"use client";

import { useEffect, useState } from "react";
import { ClientApiError, clientApi } from "../../../lib/client-api";

type LessonAsset = {
  id: string;
  assetType: string;
  provider: string;
  fileName: string | null;
  displayOrder: number | null;
};

type LessonAssetPanelProps = {
  lessonId: string;
  editable: boolean;
};

function formatError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Asset action failed.";
}

export function LessonAssetPanel({ lessonId, editable }: LessonAssetPanelProps) {
  const [assets, setAssets] = useState<LessonAsset[]>([]);
  const [objectKeyOrUrl, setObjectKeyOrUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refreshAssets() {
    const response = await clientApi.get<{ data: { items: LessonAsset[] } }>(
      `/api/v1/lessons/${lessonId}/assets?view=studio`,
    );
    setAssets(response.data.items);
  }

  useEffect(() => {
    void refreshAssets().catch(() => {
      setAssets([]);
    });
  }, [lessonId]);

  async function attachAsset() {
    if (!editable || !objectKeyOrUrl.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await clientApi.post(
        `/api/v1/lessons/${lessonId}/assets`,
        {
          assetType: "file",
          provider: objectKeyOrUrl.startsWith("http") ? "external" : "r2",
          objectKeyOrUrl: objectKeyOrUrl.trim(),
        },
        "lesson-asset-attach",
      );
      setObjectKeyOrUrl("");
      await refreshAssets();
    } catch (attachError) {
      setError(formatError(attachError));
    } finally {
      setBusy(false);
    }
  }

  async function removeAsset(assetId: string) {
    if (!editable) return;
    setBusy(true);
    setError(null);
    try {
      await clientApi.delete(
        `/api/v1/lessons/${lessonId}/assets?assetId=${assetId}`,
        "lesson-asset-delete",
      );
      await refreshAssets();
    } catch (deleteError) {
      setError(formatError(deleteError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 rounded border p-4">
      <h2>Assets</h2>
      {error ? <p role="alert">{error}</p> : null}
      <ul className="space-y-2">
        {assets.map((asset) => (
          <li key={asset.id} className="flex items-center justify-between gap-2 rounded border p-2">
            <span>
              {asset.fileName ?? asset.assetType} ({asset.provider})
            </span>
            {editable ? (
              <button type="button" disabled={busy} onClick={() => void removeAsset(asset.id)}>
                Remove
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {editable ? (
        <div className="flex gap-2">
          <input
            className="flex-1 rounded border px-3 py-2"
            placeholder="Storage reference ID or external URL"
            value={objectKeyOrUrl}
            onChange={(event) => {
              setObjectKeyOrUrl(event.target.value);
            }}
            disabled={busy}
          />
          <button
            type="button"
            disabled={busy || !objectKeyOrUrl.trim()}
            onClick={() => void attachAsset()}
          >
            Attach
          </button>
        </div>
      ) : null}
    </section>
  );
}
