"use client";

import { useEffect, useId, useRef, useState } from "react";
import { FolderOpen, Paperclip, Plus } from "lucide-react";
import { ClientApiError, clientApi } from "../../../../lib/client-api";
import { builderHelperClassName } from "../course-builder-shared";
import { inlineLessonSecondaryButtonClassName } from "./inline-lesson-editor-shared";
import {
  uploadLessonAssetFile,
  attachLessonAssetReference,
} from "../upload-lesson-asset";

type LessonAsset = {
  id: string;
  assetType: string;
  fileName: string | null;
};

type LessonAttachmentsSidebarProps = {
  lessonId: string;
  editable: boolean;
};

function formatError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Attachment action failed.";
}

export function LessonAttachmentsSidebar({ lessonId, editable }: LessonAttachmentsSidebarProps) {
  const linkInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<LessonAsset[]>([]);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
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

  async function attachLink() {
    if (!editable || !linkUrl.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await clientApi.post(
        `/api/v1/lessons/${lessonId}/assets`,
        {
          assetType: "link",
          provider: "external",
          objectKeyOrUrl: linkUrl.trim(),
        },
        "lesson-asset-link",
      );
      setLinkUrl("");
      setShowLinkForm(false);
      await refreshAssets();
    } catch (attachError) {
      setError(formatError(attachError));
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
    <aside className="flex min-h-[min(24rem,calc(100vh-14rem))] flex-col rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
      <div className="border-b border-[var(--admin-border)] px-5 py-4">
        <h2 className="text-sm font-semibold text-[var(--admin-on-surface-variant)]">Attachments</h2>
        <p className={`${builderHelperClassName} mt-1`}>
          Add attachments like docs, pdf or links
        </p>
      </div>

      <div className="flex flex-1 flex-col px-5 py-6">
        {error ? (
          <p role="alert" className="mb-4 text-sm text-[var(--admin-danger)]">
            {error}
          </p>
        ) : null}

        {assets.length === 0 && !showLinkForm ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <Paperclip
              className="mb-3 h-10 w-10 text-[var(--admin-outline)]"
              strokeWidth={1.5}
              aria-hidden="true"
            />
            <p className="text-sm font-medium text-[var(--admin-on-surface-variant)]">
              Add Attachments
            </p>
          </div>
        ) : (
          <ul className="flex-1 space-y-2 overflow-y-auto">
            {assets.map((asset) => (
              <li
                key={asset.id}
                className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2 text-sm text-[var(--admin-on-surface)]"
              >
                {asset.fileName ?? asset.assetType}
              </li>
            ))}
          </ul>
        )}

        {showLinkForm ? (
          <div className="mt-4 space-y-2 motion-safe:animate-[admin-dropdown-in_0.18s_cubic-bezier(0.16,1,0.3,1)]">
            <label htmlFor={linkInputId} className="sr-only">
              Attachment link URL
            </label>
            <input
              id={linkInputId}
              className="w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2 text-sm text-[var(--admin-on-surface)] outline-none placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30"
              placeholder="https://"
              value={linkUrl}
              disabled={busy}
              onChange={(event) => {
                setLinkUrl(event.target.value);
              }}
            />
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-lg bg-[var(--admin-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--admin-on-primary)] disabled:opacity-50"
                disabled={busy || !linkUrl.trim()}
                onClick={() => {
                  void attachLink();
                }}
              >
                Add
              </button>
              <button
                type="button"
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[var(--admin-on-surface-variant)]"
                onClick={() => {
                  setShowLinkForm(false);
                  setLinkUrl("");
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {editable ? (
        <div className="grid grid-cols-2 gap-2 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3">
          <button
            type="button"
            className={`${inlineLessonSecondaryButtonClassName} w-full`}
            disabled={busy}
            onClick={() => {
              setShowLinkForm(true);
            }}
          >
            <Plus className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            Add link
          </button>
          <button
            type="button"
            className={`${inlineLessonSecondaryButtonClassName} w-full`}
            disabled={busy}
            onClick={() => {
              fileInputRef.current?.click();
            }}
          >
            <FolderOpen className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            Browse
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
      ) : null}
    </aside>
  );
}
