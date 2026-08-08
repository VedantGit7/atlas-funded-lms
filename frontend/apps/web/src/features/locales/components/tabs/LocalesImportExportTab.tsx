"use client";

import { useState } from "react";
import { Button, Input } from "@atlas/design-system";
import { ClientApiError, clientApi } from "../../../../lib/client-api";
import {
  fieldClassName,
  localesAlertErrorClassName,
  localesAlertSuccessClassName,
  localesPrimaryButtonClassName,
  localesTextareaClassName,
} from "../../locales-admin-shared";
import { LocalePicker } from "../LocalePicker";

type ImportPreviewEntry = {
  key: string;
  action: "add" | "update" | "unchanged";
  currentValue: string | null;
  nextValue: string;
};

type LocalesImportExportTabProps = {
  canManage: boolean;
};

function parseImportPayload(raw: string): Array<{ key: string; value: string }> {
  const parsed = JSON.parse(raw) as unknown;
  if (Array.isArray(parsed)) {
    return parsed.map((entry) => {
      if (
        typeof entry === "object" &&
        entry !== null &&
        "key" in entry &&
        "value" in entry &&
        typeof entry.key === "string" &&
        typeof entry.value === "string"
      ) {
        return { key: entry.key, value: entry.value };
      }
      throw new Error("Each import item must include key and value.");
    });
  }
  if (typeof parsed === "object" && parsed !== null && "resources" in parsed && Array.isArray(parsed.resources)) {
    return parseImportPayload(JSON.stringify(parsed.resources));
  }
  throw new Error("Import JSON must be an array of { key, value } objects.");
}

export function LocalesImportExportTab({ canManage }: LocalesImportExportTabProps) {
  const [locale, setLocale] = useState("en");
  const [importJson, setImportJson] = useState("[\n  { \"key\": \"welcome.title\", \"value\": \"Welcome\" }\n]");
  const [preview, setPreview] = useState<ImportPreviewEntry[]>([]);
  const [previewSummary, setPreviewSummary] = useState<{ add: number; update: number; unchanged: number } | null>(
    null,
  );
  const [exportJson, setExportJson] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"error" | "success">("error");

  async function handlePreview() {
    if (!canManage) return;
    setBusy(true);
    setMessage(null);
    try {
      const resources = parseImportPayload(importJson);
      const response = await clientApi.post<{
        data: {
          summary: { add: number; update: number; unchanged: number };
          entries: ImportPreviewEntry[];
        };
      }>("/api/v1/locales/import/preview", { locale, resources });
      setPreview(response.data.entries);
      setPreviewSummary(response.data.summary);
      setMessage("Import preview ready.");
      setMessageTone("success");
    } catch (caught) {
      setPreview([]);
      setPreviewSummary(null);
      setMessage(caught instanceof ClientApiError ? caught.message : "Preview failed.");
      setMessageTone("error");
    } finally {
      setBusy(false);
    }
  }

  async function handleImport() {
    if (!canManage) return;
    setBusy(true);
    setMessage(null);
    try {
      const resources = parseImportPayload(importJson);
      const response = await clientApi.post<{ data: { applied: number } }>(
        "/api/v1/locales/import",
        { locale, resources },
        `locale-import-${locale}-${Date.now()}`,
      );
      setMessage(`Imported ${response.data.applied} string(s).`);
      setMessageTone("success");
      setPreview([]);
      setPreviewSummary(null);
    } catch (caught) {
      setMessage(caught instanceof ClientApiError ? caught.message : "Import failed.");
      setMessageTone("error");
    } finally {
      setBusy(false);
    }
  }

  async function handleExport() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await clientApi.get<{
        data: { resources: Array<{ key: string; value: string }> };
      }>(`/api/v1/locales/export?locale=${encodeURIComponent(locale)}&format=json`);
      setExportJson(JSON.stringify(response.data.resources, null, 2));
      setMessage("Export ready.");
      setMessageTone("success");
    } catch (caught) {
      setMessage(caught instanceof ClientApiError ? caught.message : "Export failed.");
      setMessageTone("error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4 sm:p-6">
      {message ? (
        <div
          role="alert"
          className={messageTone === "success" ? localesAlertSuccessClassName : localesAlertErrorClassName}
        >
          {message}
        </div>
      ) : null}

      <section className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-[var(--admin-on-surface)]">Import bundle</h2>
        {!canManage ? (
          <p className="mt-2 text-sm text-[var(--admin-on-surface-variant)]">Read-only access.</p>
        ) : null}
        <div className="mt-4 space-y-4">
          <LocalePicker value={locale} onChange={setLocale} existingLocales={[locale]} />
          <textarea
            value={importJson}
            onChange={(event) => setImportJson(event.target.value)}
            className={localesTextareaClassName}
            disabled={!canManage || busy}
            aria-label="Import JSON"
          />
          {canManage ? (
            <div className="flex flex-wrap gap-2">
              <Button className={localesPrimaryButtonClassName} disabled={busy} onClick={() => void handlePreview()}>
                Preview diff
              </Button>
              <Button variant="ghost" disabled={busy || preview.length === 0} onClick={() => void handleImport()}>
                Apply import
              </Button>
            </div>
          ) : null}
          {previewSummary ? (
            <p className="text-xs text-[var(--admin-on-surface-variant)]">
              Preview: {previewSummary.add} add, {previewSummary.update} update, {previewSummary.unchanged} unchanged
            </p>
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-[var(--admin-on-surface)]">Export bundle</h2>
        <div className="mt-4 space-y-4">
          <LocalePicker value={locale} onChange={setLocale} existingLocales={[locale]} />
          <Button className={localesPrimaryButtonClassName} disabled={busy} onClick={() => void handleExport()}>
            Export JSON
          </Button>
          {exportJson ? (
            <textarea
              readOnly
              value={exportJson}
              className={localesTextareaClassName}
              aria-label="Export JSON"
            />
          ) : (
            <Input className={fieldClassName} readOnly value="" placeholder="Exported JSON will appear here" />
          )}
        </div>
      </section>
    </div>
  );
}
