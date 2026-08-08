"use client";

import { ChevronDown, Code2 } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { codeEditorClassName, editorHintClassName, editorLabelClassName } from "./editor-styles";

type AdvancedJsonPanelProps = {
  label?: string;
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
  hint?: string;
};

export function AdvancedJsonPanel({
  label = "Advanced JSON",
  value,
  onChange,
  hint = "Power-user override. Visual editors stay in sync when JSON is valid.",
}: AdvancedJsonPanelProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(() => JSON.stringify(value, null, 2));
  const [error, setError] = useState<string | null>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) {
      setText(JSON.stringify(value, null, 2));
    }
  }, [open, value]);

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpen((current) => {
            const next = !current;
            if (next) {
              setText(JSON.stringify(value, null, 2));
              setError(null);
            }
            return next;
          });
        }}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--admin-surface-high)]"
      >
        <span className="inline-flex items-center gap-2 text-sm font-medium text-[var(--admin-on-surface)]">
          <Code2 className="h-4 w-4 text-[var(--admin-on-surface-variant)]" aria-hidden="true" />
          {label}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-[var(--admin-on-surface-variant)] transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      <div
        id={panelId}
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="space-y-2 border-t border-[var(--admin-border)] px-4 py-4">
            <p className={editorHintClassName}>{hint}</p>
            <label className={editorLabelClassName} htmlFor={`${panelId}-json`}>
              JSON object
            </label>
            <textarea
              id={`${panelId}-json`}
              rows={8}
              spellCheck={false}
              value={text}
              onChange={(event) => {
                const nextText = event.target.value;
                setText(nextText);
                try {
                  const parsed: unknown = JSON.parse(nextText);
                  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
                    setError("Must be a JSON object.");
                    return;
                  }
                  setError(null);
                  onChange(parsed as Record<string, unknown>);
                } catch {
                  setError("Invalid JSON syntax.");
                }
              }}
              className={codeEditorClassName}
            />
            {error ? <p className="text-xs text-[var(--admin-danger)]">{error}</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
