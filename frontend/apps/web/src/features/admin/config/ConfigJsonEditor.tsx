"use client";

import { useMemo, useRef } from "react";
import { AlertCircle } from "lucide-react";
import { BrandingAnimatedCollapsible } from "../../../app/admin/branding/_components/branding-admin-shared";
import {
  codeEditorGutterClassName,
  codeEditorShellClassName,
  codeEditorTextareaClassName,
} from "./config-admin-shared";
import { countLines, type JsonParseResult } from "./config-json-utils";

type ConfigJsonEditorProps = {
  value: string;
  onChange: (value: string) => void;
  parseResult: JsonParseResult | null;
  label: string;
  minLines?: number;
  variant?: "section" | "advanced";
};

export function ConfigJsonEditor({
  value,
  onChange,
  parseResult,
  label,
  minLines = 12,
  variant = "section",
}: ConfigJsonEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineCount = Math.max(countLines(value), minLines);
  const hasError = parseResult != null && !parseResult.ok;
  const errorLine = hasError ? parseResult.line : null;

  const lineNumbers = useMemo(
    () => Array.from({ length: lineCount }, (_, index) => index + 1),
    [lineCount],
  );

  function jumpToErrorLine() {
    if (!textareaRef.current || errorLine == null) return;
    const lines = value.split("\n");
    const offset = lines.slice(0, errorLine - 1).join("\n").length + (errorLine > 1 ? 1 : 0);
    textareaRef.current.focus();
    textareaRef.current.setSelectionRange(offset, offset);
  }

  const shellClass =
    variant === "advanced"
      ? `${codeEditorShellClassName} border-[var(--admin-warning)]/30`
      : codeEditorShellClassName;

  return (
    <div className="space-y-3">
      <div
        className={[
          shellClass,
          "flex",
          hasError ? "border-[var(--admin-danger)] ring-2 ring-[var(--admin-danger)]/20" : "",
        ].join(" ")}
      >
        <div className={`${codeEditorGutterClassName} w-10 shrink-0 px-2`} aria-hidden="true">
          {lineNumbers.map((line) => (
            <div
              key={line}
              className={[
                "leading-relaxed",
                errorLine === line ? "font-bold text-[var(--admin-danger)]" : "",
              ].join(" ")}
            >
              {line}
            </div>
          ))}
        </div>
        <textarea
          ref={textareaRef}
          value={value}
          spellCheck={false}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          aria-label={label}
          aria-invalid={hasError}
          className={codeEditorTextareaClassName}
        />
      </div>

      <BrandingAnimatedCollapsible open={hasError} id="config-json-parse-error">
        {hasError ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--admin-danger)]/30 bg-[var(--admin-danger)]/10 px-4 py-3 text-sm text-[var(--admin-danger)]">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <p className="flex-1">
              {errorLine != null ? (
                <>
                  JSON syntax error on line {errorLine}
                  {parseResult.column != null ? `, column ${parseResult.column}` : ""}:{" "}
                </>
              ) : null}
              {parseResult.message}
            </p>
            {errorLine != null ? (
              <button
                type="button"
                onClick={jumpToErrorLine}
                className="font-semibold underline motion-safe:transition-opacity hover:opacity-80"
              >
                Jump to line
              </button>
            ) : null}
          </div>
        ) : null}
      </BrandingAnimatedCollapsible>
    </div>
  );
}
