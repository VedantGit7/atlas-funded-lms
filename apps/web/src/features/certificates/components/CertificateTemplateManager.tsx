"use client";

import { useMemo, useState } from "react";
import type { z } from "zod";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import type { certificateTemplateDtoSchema } from "../../../server/certificates/certificate.dto";
import { certificateTemplateFieldSchema } from "../../../server/certificates/certificate.dto";

type TemplateDto = z.infer<typeof certificateTemplateDtoSchema>;

type CertificateTemplateManagerProps = {
  initialTemplates: TemplateDto[];
};

const defaultTemplateJson = {
  headline: "Certificate of Achievement",
  subheadline: "Awarded for successful completion",
  bodyLines: ["This certifies outstanding performance."],
};

export function CertificateTemplateManager({ initialTemplates }: CertificateTemplateManagerProps) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [selectedId, setSelectedId] = useState<string | null>(initialTemplates[0]?.id ?? null);
  const [draftKey, setDraftKey] = useState("completion");
  const [draftName, setDraftName] = useState("Completion Certificate");
  const [editorJson, setEditorJson] = useState(JSON.stringify(defaultTemplateJson, null, 2));
  const [message, setMessage] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const selected = useMemo(
    () => templates.find((template) => template.id === selectedId) ?? null,
    [templates, selectedId],
  );

  function setError(caught: unknown) {
    if (caught instanceof ClientApiError) {
      setMessage(caught.message);
      setRequestId(caught.requestId);
      return;
    }
    setMessage("Unexpected error.");
    setRequestId(null);
  }

  async function refreshTemplates() {
    const response = await clientApi.get<{ data: TemplateDto[] }>("/api/v1/certificate-templates");
    setTemplates(response.data);
  }

  async function createDraft() {
    setMessage(null);
    setRequestId(null);
    try {
      const response = await clientApi.post<{ data: TemplateDto }>(
        "/api/v1/certificate-templates",
        {
          key: draftKey,
          name: draftName,
          templateJson: defaultTemplateJson,
        },
        "template-create",
      );
      await refreshTemplates();
      setSelectedId(response.data.id);
      setMessage("Draft template created.");
    } catch (caught) {
      setError(caught);
    }
  }

  async function saveSelected() {
    if (!selected) return;
    setMessage(null);
    setRequestId(null);
    try {
      const parsed = certificateTemplateFieldSchema.parse(JSON.parse(editorJson));
      await clientApi.put(
        "/api/v1/certificate-templates",
        { id: selected.id, templateJson: parsed },
        "template-update",
      );
      await refreshTemplates();
      setMessage("Template saved.");
    } catch (caught) {
      setError(caught);
    }
  }

  async function publishSelected() {
    if (!selected || !confirmPublish) return;
    setMessage(null);
    setRequestId(null);
    try {
      await clientApi.post(
        `/api/v1/certificate-templates/${selected.id}/publish`,
        {},
        "template-publish",
      );
      await refreshTemplates();
      setConfirmPublish(false);
      setMessage("Template published.");
    } catch (caught) {
      setError(caught);
    }
  }

  async function deleteSelected() {
    if (!selected || !confirmDelete) return;
    setMessage(null);
    setRequestId(null);
    try {
      await clientApi.delete("/api/v1/certificate-templates", "template-delete", {
        id: selected.id,
      });
      await refreshTemplates();
      setSelectedId(null);
      setConfirmDelete(false);
      setMessage("Template deleted.");
    } catch (caught) {
      setError(caught);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <aside className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Templates
        </h2>
        <ul className="space-y-2">
          {templates.map((template) => (
            <li key={template.id}>
              <button
                type="button"
                className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                  selectedId === template.id ? "border-neutral-900" : "border-neutral-200"
                }`}
                onClick={() => {
                  setSelectedId(template.id);
                  setEditorJson(JSON.stringify(template.templateJson, null, 2));
                }}
              >
                <span className="font-medium">{template.name}</span>
                <span className="mt-1 block text-xs uppercase text-neutral-500">
                  {template.status}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="rounded-md border border-dashed border-neutral-300 p-3">
          <label className="block text-xs font-medium">Key</label>
          <input
            className="mt-1 w-full rounded border px-2 py-1 text-sm"
            value={draftKey}
            onChange={(event) => {
              setDraftKey(event.target.value);
            }}
          />
          <label className="mt-2 block text-xs font-medium">Name</label>
          <input
            className="mt-1 w-full rounded border px-2 py-1 text-sm"
            value={draftName}
            onChange={(event) => {
              setDraftName(event.target.value);
            }}
          />
          <button
            type="button"
            className="mt-3 w-full rounded-md bg-neutral-900 px-3 py-2 text-sm text-white"
            onClick={() => void createDraft()}
          >
            Create draft
          </button>
        </div>
      </aside>

      <section className="space-y-4">
        {selected ? (
          <>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-md border px-3 py-2 text-sm"
                onClick={() => void saveSelected()}
              >
                Save draft
              </button>
              <button
                type="button"
                className="rounded-md border px-3 py-2 text-sm"
                onClick={() => {
                  setConfirmPublish(true);
                }}
              >
                Publish
              </button>
              <button
                type="button"
                className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-700"
                onClick={() => {
                  setConfirmDelete(true);
                }}
              >
                Delete
              </button>
            </div>
            <textarea
              className="min-h-[220px] w-full rounded-md border border-neutral-300 p-3 font-mono text-sm"
              value={editorJson}
              onChange={(event) => {
                setEditorJson(event.target.value);
              }}
            />
            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4">
              <h3 className="text-sm font-semibold">Sanitized preview</h3>
              <pre className="mt-2 overflow-auto text-xs">{editorJson}</pre>
            </div>
          </>
        ) : (
          <p className="text-sm text-neutral-600">Select a template or create a draft.</p>
        )}

        {confirmPublish ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm">
            <p>Publish this template through the workflow gate?</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="rounded-md border px-3 py-1"
                onClick={() => {
                  setConfirmPublish(false);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-md bg-neutral-900 px-3 py-1 text-white"
                onClick={() => void publishSelected()}
              >
                Confirm publish
              </button>
            </div>
          </div>
        ) : null}

        {confirmDelete ? (
          <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm">
            <p>Delete this draft template?</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="rounded-md border px-3 py-1"
                onClick={() => {
                  setConfirmDelete(false);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-md bg-red-700 px-3 py-1 text-white"
                onClick={() => void deleteSelected()}
              >
                Confirm delete
              </button>
            </div>
          </div>
        ) : null}

        {message ? <p className="text-sm text-neutral-700">{message}</p> : null}
        {requestId ? <p className="text-xs text-neutral-500">Request ID: {requestId}</p> : null}
      </section>
    </div>
  );
}
