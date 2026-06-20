"use client";

import { useMemo, useState } from "react";
import type { z } from "zod";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import type { notificationTemplateDtoSchema } from "../../../server/notifications/notification.dto";
import { NOTIFICATION_SOURCE_EVENT_KEYS } from "../../../server/notifications/notification.events";

type TemplateDto = z.infer<typeof notificationTemplateDtoSchema>;

type NotificationTemplateManagerProps = {
  initialTemplates: TemplateDto[];
};

const defaultBody = "Your certificate was issued on {{issuedAt}}.";

export function NotificationTemplateManager({
  initialTemplates,
}: NotificationTemplateManagerProps) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [selectedId, setSelectedId] = useState<string | null>(initialTemplates[0]?.id ?? null);
  const [draftKey, setDraftKey] =
    useState<(typeof NOTIFICATION_SOURCE_EVENT_KEYS)[number]>("certificate.issued");
  const [draftChannel, setDraftChannel] = useState<"in_app" | "email">("in_app");
  const [draftLocale, setDraftLocale] = useState("en");
  const [draftSubject, setDraftSubject] = useState("");
  const [draftBody, setDraftBody] = useState(defaultBody);
  const [message, setMessage] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
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
    const response = await clientApi.get<{ data: TemplateDto[] }>("/api/v1/notification-templates");
    setTemplates(response.data);
  }

  async function createTemplate() {
    setMessage(null);
    setRequestId(null);
    try {
      const response = await clientApi.post<{ data: TemplateDto }>(
        "/api/v1/notification-templates",
        {
          key: draftKey,
          channel: draftChannel,
          locale: draftLocale,
          subject: draftChannel === "email" ? draftSubject || "Certificate issued" : undefined,
          body: draftBody,
          variablesJson: {
            variables: [{ name: "issuedAt", description: "Issue date" }],
            defaultActionPath: "/certificates",
          },
        },
        "notification-template-create",
      );
      await refreshTemplates();
      setSelectedId(response.data.id);
      setMessage("Template created.");
    } catch (caught) {
      setError(caught);
    }
  }

  async function saveSelected() {
    if (!selected) return;
    setMessage(null);
    setRequestId(null);
    try {
      await clientApi.put(
        "/api/v1/notification-templates",
        {
          id: selected.id,
          body: draftBody,
          subject: selected.channel === "email" ? draftSubject : null,
          variablesJson: selected.variablesJson,
        },
        "notification-template-update",
      );
      await refreshTemplates();
      setMessage("Template saved.");
    } catch (caught) {
      setError(caught);
    }
  }

  async function deleteSelected() {
    if (!selected || !confirmDelete) return;
    setMessage(null);
    setRequestId(null);
    try {
      await clientApi.delete("/api/v1/notification-templates", "notification-template-delete", {
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

  function selectTemplate(template: TemplateDto) {
    setSelectedId(template.id);
    setDraftBody(template.body);
    setDraftSubject(template.subject ?? "");
  }

  return (
    <div className="space-y-6">
      {message ? (
        <p role="status">
          {message}
          {requestId ? ` (Request ID: ${requestId})` : null}
        </p>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-3 rounded border p-4">
          <h2 className="font-medium">Templates</h2>
          {templates.length === 0 ? (
            <p>No notification templates yet.</p>
          ) : (
            <ul className="space-y-2">
              {templates.map((template) => (
                <li key={template.id}>
                  <button
                    type="button"
                    className={`w-full rounded border px-3 py-2 text-left ${
                      selectedId === template.id ? "border-black" : "border-transparent"
                    }`}
                    onClick={() => {
                      selectTemplate(template);
                    }}
                  >
                    <div className="font-medium">{template.key}</div>
                    <div className="text-sm text-gray-600">
                      {template.channel} · {template.locale}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-4 rounded border p-4">
          <h2 className="font-medium">{selected ? "Edit template" : "Create template"}</h2>

          {!selected ? (
            <div className="grid gap-3">
              <label className="grid gap-1">
                <span>Event key</span>
                <select
                  value={draftKey}
                  onChange={(event) => {
                    setDraftKey(
                      event.target.value as (typeof NOTIFICATION_SOURCE_EVENT_KEYS)[number],
                    );
                  }}
                >
                  {NOTIFICATION_SOURCE_EVENT_KEYS.map((key) => (
                    <option key={key} value={key}>
                      {key}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1">
                <span>Channel</span>
                <select
                  value={draftChannel}
                  onChange={(event) => {
                    setDraftChannel(event.target.value as "in_app" | "email");
                  }}
                >
                  <option value="in_app">in_app</option>
                  <option value="email">email</option>
                </select>
              </label>
              <label className="grid gap-1">
                <span>Locale</span>
                <input
                  value={draftLocale}
                  onChange={(event) => {
                    setDraftLocale(event.target.value);
                  }}
                />
              </label>
            </div>
          ) : null}

          {(selected?.channel === "email" || draftChannel === "email") && (
            <label className="grid gap-1">
              <span>Subject</span>
              <input
                value={draftSubject}
                onChange={(event) => {
                  setDraftSubject(event.target.value);
                }}
              />
            </label>
          )}

          <label className="grid gap-1">
            <span>Body (plain text)</span>
            <textarea
              className="min-h-32 w-full rounded border p-2 font-mono text-sm"
              value={draftBody}
              onChange={(event) => {
                setDraftBody(event.target.value);
              }}
            />
          </label>

          <div className="rounded bg-gray-50 p-3 text-sm">
            <h3 className="font-medium">Preview</h3>
            <p>{draftBody.replace("{{issuedAt}}", "Jun 20, 2026")}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {selected ? (
              <>
                <button
                  type="button"
                  className="rounded border px-3 py-2"
                  onClick={() => void saveSelected()}
                >
                  Save
                </button>
                <button
                  type="button"
                  className="rounded border px-3 py-2"
                  onClick={() => {
                    setConfirmDelete(true);
                  }}
                >
                  Delete
                </button>
              </>
            ) : (
              <button
                type="button"
                className="rounded border px-3 py-2"
                onClick={() => void createTemplate()}
              >
                Create template
              </button>
            )}
          </div>

          {confirmDelete ? (
            <div
              className="rounded border border-red-300 p-3"
              role="alertdialog"
              aria-label="Confirm delete"
            >
              <p>Delete this template? Existing dispatches are preserved.</p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className="rounded border px-3 py-2"
                  onClick={() => void deleteSelected()}
                >
                  Confirm delete
                </button>
                <button
                  type="button"
                  className="rounded border px-3 py-2"
                  onClick={() => {
                    setConfirmDelete(false);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
