"use client";

import {
  answerFileProblem,
  answerFileRules,
  describeAnswerFileTypes,
  type AnswerFileRules,
} from "@atlas/contracts/item-registry/answer-rules.contract";
import type { ItemResponseUiState } from "@atlas/contracts/item-registry/answer-ui";
import { FileText, Loader2, Upload } from "lucide-react";
import { useId, useState } from "react";

export type UploadedFile = {
  assetReferenceId: string;
  fileName: string;
  sizeBytes: number;
  contentType: string;
};

type FileUploadState = Extract<ItemResponseUiState, { type: "file_upload" }>;

function formatSize(bytes: number | undefined): string | null {
  if (bytes == null) return null;
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 * 1024) return `${String(Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * An upload question's answer (QA review 1 m26; S3.4c). In a real attempt the
 * file is uploaded and confirmed before it's saved as the answer; in the
 * author's preview it's only checked against the question's rules. It used to
 * be a box for typing a file name, so graders never got a file.
 */
export function FileUploadResponse({
  state,
  updateState,
  disabled,
  answerKey,
  limits,
  onUploadFile,
  onOpenFile,
}: {
  state: FileUploadState;
  updateState: (next: ItemResponseUiState) => void;
  disabled: boolean;
  answerKey: Record<string, unknown>;
  limits?: { fileTypes?: string[] | undefined; maxFileSizeMb?: number | undefined } | undefined;
  onUploadFile?: ((file: File) => Promise<UploadedFile>) | undefined;
  onOpenFile?: ((assetReferenceId: string) => void) | undefined;
}) {
  const inputId = useId();
  const hintId = useId();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A real attempt gets the rules from the server; the preview reads the answer key.
  const rules: AnswerFileRules = limits?.fileTypes
    ? {
        types: limits.fileTypes as AnswerFileRules["types"],
        maxMb: limits.maxFileSizeMb ?? 10,
      }
    : answerFileRules(answerKey);
  const accept = rules.types.map((type) => `.${type}`).join(",");
  const hint = `${describeAnswerFileTypes(rules.types)} · up to ${String(rules.maxMb)} MB`;

  async function choose(file: File | undefined) {
    if (!file) return;
    setError(null);
    const problem = answerFileProblem(rules, { fileName: file.name, sizeBytes: file.size });
    if (problem) {
      setError(problem);
      return;
    }
    if (!onUploadFile) {
      updateState({ type: "file_upload", fileName: file.name, sizeBytes: file.size });
      return;
    }
    setUploading(true);
    try {
      const uploaded = await onUploadFile(file);
      updateState({ type: "file_upload", ...uploaded });
    } catch (err) {
      setError(err instanceof Error ? err.message : "The file couldn't be uploaded. Try again.");
    } finally {
      setUploading(false);
    }
  }

  const hasFile = state.fileName.trim().length > 0;
  const size = formatSize(state.sizeBytes);

  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-5">
        {hasFile ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <FileText
                className="h-8 w-8 shrink-0 text-[var(--admin-on-surface-variant)]"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--admin-on-surface)]">
                  {state.fileName}
                </p>
                <p className="text-xs text-[var(--admin-on-surface-variant)]">
                  {[size, state.assetReferenceId ? "Uploaded" : null].filter(Boolean).join(" · ")}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pl-11">
              {state.assetReferenceId && onOpenFile ? (
                <button
                  type="button"
                  onClick={() => {
                    if (state.assetReferenceId) onOpenFile(state.assetReferenceId);
                  }}
                  className="rounded-lg border border-[var(--admin-border)] px-3 py-1.5 text-sm font-medium text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/40"
                >
                  Open
                </button>
              ) : null}
              {!disabled ? (
                <label
                  htmlFor={inputId}
                  className={`cursor-pointer rounded-lg border border-[var(--admin-border)] px-3 py-1.5 text-sm font-medium text-[var(--admin-primary)] hover:bg-[var(--admin-surface-high)] ${uploading ? "pointer-events-none opacity-50" : ""}`}
                >
                  Replace
                </label>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="text-center">
            {uploading ? (
              <Loader2
                className="mx-auto h-8 w-8 text-[var(--admin-on-surface-variant)] motion-safe:animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Upload
                className="mx-auto h-8 w-8 text-[var(--admin-on-surface-variant)]"
                aria-hidden="true"
              />
            )}
            <label
              htmlFor={inputId}
              className={`mt-2 inline-block cursor-pointer rounded-lg bg-[var(--admin-primary)] px-4 py-2 text-sm font-semibold text-[var(--admin-on-primary)] hover:opacity-90 ${disabled || uploading ? "pointer-events-none opacity-50" : ""}`}
            >
              {uploading ? "Uploading…" : "Choose a file"}
            </label>
          </div>
        )}
        <p id={hintId} className="mt-3 text-center text-xs text-[var(--admin-on-surface-variant)]">
          {uploading && hasFile ? "Uploading the new file…" : hint}
        </p>
        <input
          id={inputId}
          type="file"
          accept={accept}
          disabled={disabled || uploading}
          aria-describedby={hintId}
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            void choose(file);
          }}
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-[var(--admin-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
