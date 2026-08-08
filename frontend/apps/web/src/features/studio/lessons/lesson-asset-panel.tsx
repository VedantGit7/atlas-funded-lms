"use client";

import { useEffect, useRef, useState } from "react";
import { FileImage, FileText, Paperclip, Plus, X } from "lucide-react";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import {
  lessonCardClassName,
  lessonCardTitleClassName,
  lessonInputClassName,
} from "./lesson-editor-shared";
import {
  uploadLessonAssetFile,
  attachLessonAssetReference,
} from "../courses/upload-lesson-asset";

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

function assetIcon(assetType: string) {
  if (assetType.includes("image")) {
    return <FileImage className="h-[18px] w-[18px] text-[var(--admin-primary)]" aria-hidden="true" />;
  }
  return <FileText className="h-[18px] w-[18px] text-[var(--admin-danger)]" aria-hidden="true" />;
}

export function LessonAssetPanel({ lessonId, editable }: LessonAssetPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<LessonAsset[]>([]);
  const [objectKeyOrUrl, setObjectKeyOrUrl] = useState("");
  const [showAttach, setShowAttach] = useState(false);
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
      setShowAttach(false);
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

  async function attachFile(file: File) {
    if (!editable) return;
    setBusy(true);
    setError(null);
    try {
      const assetReferenceId = await uploadLessonAssetFile(
        lessonId,
        file,
        "lesson.attachment",
      );
      await attachLessonAssetReference(lessonId, assetReferenceId, file.type || "file");
      await refreshAssets();
    } catch (attachError) {
      setError(formatError(attachError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={lessonCardClassName}>
      <div className="flex items-center gap-2 text-[var(--admin-on-surface)]">
        <Paperclip className="h-[18px] w-[18px] text-[var(--admin-primary)]" aria-hidden="true" />
        <h2 className={lessonCardTitleClassName}>Lesson Assets</h2>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-[var(--admin-danger)]">
          {error}
        </p>
      ) : null}

      <ul className="space-y-1">
        {assets.length === 0 ? (
          <li className="rounded-lg px-2 py-3 text-sm text-[var(--admin-on-surface-variant)]">
            No assets attached yet.
          </li>
        ) : (
          assets.map((asset) => (
            <li
              key={asset.id}
              className="group flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-[var(--admin-surface-high)]"
            >
              <div className="flex min-w-0 items-center gap-2">
                {assetIcon(asset.assetType)}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--admin-on-surface)]">
                    {asset.fileName ?? asset.assetType}
                  </p>
                  <span className="inline-block rounded bg-[var(--admin-surface-high)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--admin-outline)]">
                    {asset.provider}
                  </span>
                </div>
              </div>
              {editable ? (
                <button
                  type="button"
                  aria-label={`Remove ${asset.fileName ?? asset.assetType}`}
                  className="text-[var(--admin-outline)] opacity-0 transition-opacity hover:text-[var(--admin-danger)] group-hover:opacity-100"
                  disabled={busy}
                  onClick={() => {
                    void removeAsset(asset.id);
                  }}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : null}
            </li>
          ))
        )}
      </ul>

      {editable ? (
        <div className="border-t border-[var(--admin-border)] pt-3">
          {showAttach ? (
            <div className="space-y-2 motion-safe:animate-[admin-dropdown-in_0.18s_cubic-bezier(0.16,1,0.3,1)]">
              <input
                className={lessonInputClassName}
                placeholder="Storage reference ID or external URL"
                value={objectKeyOrUrl}
                onChange={(event) => {
                  setObjectKeyOrUrl(event.target.value);
                }}
                disabled={busy}
                autoFocus
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void attachAsset();
                  }
                  if (event.key === "Escape") {
                    setShowAttach(false);
                    setObjectKeyOrUrl("");
                  }
                }}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-[var(--admin-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--admin-on-primary)] disabled:opacity-50"
                  disabled={busy || !objectKeyOrUrl.trim()}
                  onClick={() => {
                    void attachAsset();
                  }}
                >
                  Attach
                </button>
                <button
                  type="button"
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[var(--admin-on-surface-variant)]"
                  onClick={() => {
                    setShowAttach(false);
                    setObjectKeyOrUrl("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <button
                type="button"
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--admin-border)] p-2 text-xs font-semibold text-[var(--admin-on-surface-variant)] transition-colors hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)]"
                onClick={() => {
                  setShowAttach(true);
                }}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add asset
              </button>
              <button
                type="button"
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--admin-border)] p-2 text-xs font-semibold text-[var(--admin-on-surface-variant)] transition-colors hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)]"
                onClick={() => {
                  fileInputRef.current?.click();
                }}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Upload file
              </button>
              <input
                ref={fileInputRef}
                type="file"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void attachFile(file);
                  event.target.value = "";
                }}
              />
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
