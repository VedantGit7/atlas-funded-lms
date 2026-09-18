"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import { Upload, X } from "lucide-react";
import type { z } from "zod";
import type { studioModuleOutlineItemSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import { RoleToggle } from "./admin-form-dropdown-shared";
import { builderHelperClassName } from "./course-builder-shared";
import {
  RequiredMark,
  dialogLabelClassName,
  fieldClassName,
  primaryButtonClassName,
  statusBannerClassName,
} from "./create-course-dialog-shared";
import {
  inferScormPackageContentType,
  uploadModuleScormPackage,
} from "./upload-module-scorm-package";

type ModuleItem = z.infer<typeof studioModuleOutlineItemSchema>;

type AddChapterDialogProps = {
  open: boolean;
  courseId: string;
  onClose: () => void;
  onCreated: (module: ModuleItem) => void;
};

function formatError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Failed to create chapter.";
}

export function AddChapterDialog({ open, courseId, onClose, onCreated }: AddChapterDialogProps) {
  const titleId = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const [title, setTitle] = useState("");
  const [scormEnabled, setScormEnabled] = useState(false);
  const [scormFile, setScormFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setScormEnabled(false);
    setScormFile(null);
    setError(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const focusTimer = window.setTimeout(() => {
      titleRef.current?.focus();
    }, 0);

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) {
        event.stopPropagation();
        handleClose();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = overflow;
      previouslyFocused.current?.focus();
    };
  }, [open, busy]);

  function handleClose() {
    if (busy) return;
    onClose();
  }

  function handleScormFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const contentType = inferScormPackageContentType(file);
    if (!contentType) {
      setError("SCORM packages must be uploaded as a .zip file.");
      setScormFile(null);
      return;
    }

    setError(null);
    setScormFile(file);
  }

  const canSubmit = title.trim().length > 0 && (!scormEnabled || scormFile != null) && !busy;

  async function handleSubmit(event: React.SyntheticEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    setBusy(true);
    setError(null);

    try {
      const response = await clientApi.post<{ data: ModuleItem }>(
        `/api/v1/courses/${courseId}/modules`,
        {
          title: title.trim(),
          ...(scormEnabled ? { contentKind: "scorm" as const } : {}),
        },
        "module-create",
      );

      if (scormEnabled && scormFile) {
        await uploadModuleScormPackage(response.data.id, scormFile);
        const refreshed = await clientApi.get<{ data: { items: ModuleItem[] } }>(
          `/api/v1/courses/${courseId}/modules?view=studio`,
        );
        const created =
          refreshed.data.items.find((item) => item.id === response.data.id) ?? response.data;
        onCreated(created);
      } else {
        onCreated(response.data);
      }

      handleClose();
    } catch (submitError) {
      setError(formatError(submitError));
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="admin-theme fixed inset-0 z-[75] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        className="absolute inset-0 bg-[var(--admin-scrim)] backdrop-blur-sm motion-safe:animate-[admin-fade-in_0.15s_ease-out]"
        onClick={handleClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-2xl motion-safe:animate-[admin-dialog-in_0.2s_cubic-bezier(0.16,1,0.3,1)]"
      >
        <div className="flex items-center justify-between border-b border-[var(--admin-border)] px-6 py-5">
          <h2 id={titleId} className="text-xl font-bold text-[var(--admin-on-surface)]">
            Add Chapter
          </h2>
          <button
            type="button"
            aria-label="Close"
            disabled={busy}
            onClick={handleClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] disabled:opacity-50"
          >
            <X className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
        </div>

        <form className="space-y-5 px-6 py-6" onSubmit={(event) => void handleSubmit(event)}>
          <div>
            <label htmlFor="chapter-title" className={dialogLabelClassName}>
              Title
              <RequiredMark />
            </label>
            <input
              ref={titleRef}
              id="chapter-title"
              className={fieldClassName}
              placeholder=""
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
              }}
              disabled={busy}
              required
            />
          </div>

          <div className="space-y-2">
            <RoleToggle
              label="SCORM Package"
              checked={scormEnabled}
              disabled={busy}
              onChange={(checked) => {
                setScormEnabled(checked);
                if (!checked) {
                  setScormFile(null);
                  setError(null);
                }
              }}
            />
            <p className={builderHelperClassName}>
              Enable this only if you want to upload a SCORM package as a chapter.
            </p>
          </div>

          {scormEnabled ? (
            <div className="space-y-2 motion-safe:animate-[admin-dropdown-in_0.18s_cubic-bezier(0.16,1,0.3,1)]">
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip,application/zip,application/x-zip-compressed"
                className="sr-only"
                disabled={busy}
                onChange={handleScormFileChange}
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  fileInputRef.current?.click();
                }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-2.5 text-sm font-semibold text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)] disabled:opacity-50"
              >
                <Upload
                  className="h-4 w-4 text-[var(--admin-on-surface-variant)]"
                  aria-hidden="true"
                />
                Upload a ZIP file
              </button>
              {scormFile ? (
                <p className="truncate text-sm text-[var(--admin-on-surface-variant)]">
                  Selected:{" "}
                  <span className="font-medium text-[var(--admin-on-surface)]">
                    {scormFile.name}
                  </span>
                </p>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <p
              role="alert"
              className={`${statusBannerClassName} border-[var(--admin-danger)]/30 bg-[var(--admin-danger)]/10 text-[var(--admin-danger)]`}
            >
              {error}
            </p>
          ) : null}

          <div className="flex justify-end border-t border-[var(--admin-border)] pt-5">
            <button type="submit" disabled={!canSubmit} className={primaryButtonClassName}>
              {busy ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
