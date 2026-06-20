"use client";

import { useMemo, useState } from "react";
import type { z } from "zod";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import type { localeResourceDtoSchema } from "../../../server/locales/locale.dto";

type LocaleResourceDto = z.infer<typeof localeResourceDtoSchema>;

type LocalesAdminProps = {
  initialResources: LocaleResourceDto[];
  canManage: boolean;
};

export function LocalesAdmin({ initialResources, canManage }: LocalesAdminProps) {
  const locales = useMemo(
    () => [...new Set(initialResources.map((resource) => resource.locale))].sort(),
    [initialResources],
  );
  const [selectedLocale, setSelectedLocale] = useState(locales[0] ?? "en");
  const [draftKey, setDraftKey] = useState("");
  const [draftValue, setDraftValue] = useState("");
  const [resources, setResources] = useState(initialResources);
  const [message, setMessage] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  const localeResources = useMemo(
    () => resources.filter((resource) => resource.locale === selectedLocale),
    [resources, selectedLocale],
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

  async function refreshResources() {
    const response = await clientApi.get<{ data: LocaleResourceDto[] }>("/api/v1/locales");
    setResources(response.data);
  }

  async function saveResource() {
    if (!canManage || !draftKey || !draftValue) return;
    setMessage(null);
    setRequestId(null);
    try {
      await clientApi.put(
        `/api/v1/locales/${selectedLocale}`,
        {
          resources: [{ key: draftKey, value: draftValue }],
        },
        `locale-upsert-${selectedLocale}-${draftKey}`,
      );
      await refreshResources();
      setDraftKey("");
      setDraftValue("");
      setMessage("Locale resource saved.");
    } catch (caught) {
      setError(caught);
    }
  }

  function editResource(resource: LocaleResourceDto) {
    setDraftKey(resource.key);
    setDraftValue(resource.value);
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
      <div className="space-y-4 rounded border p-4">
        <h2 className="text-lg font-semibold">Locales</h2>
        {locales.length === 0 ? (
          <p className="text-sm text-muted-foreground">No locale resources yet.</p>
        ) : (
          <ul className="space-y-2">
            {locales.map((locale) => (
              <li key={locale}>
                <button
                  type="button"
                  className={`w-full rounded border px-3 py-2 text-left ${selectedLocale === locale ? "border-primary" : ""}`}
                  onClick={() => {
                    setSelectedLocale(locale);
                  }}
                >
                  {locale}
                </button>
              </li>
            ))}
          </ul>
        )}
        {canManage ? (
          <label className="block space-y-1">
            <span className="text-sm font-medium">Active locale code</span>
            <input
              className="w-full rounded border px-3 py-2"
              value={selectedLocale}
              onChange={(event) => {
                setSelectedLocale(event.target.value);
              }}
            />
          </label>
        ) : null}
      </div>

      <div className="space-y-4 rounded border p-4">
        <h2 className="text-lg font-semibold">Strings for {selectedLocale}</h2>
        {!canManage ? <p role="status">You have read-only access to locale resources.</p> : null}

        <div className="space-y-2">
          {localeResources.length === 0 ? (
            <p className="text-sm text-muted-foreground">No strings for this locale yet.</p>
          ) : (
            localeResources.map((resource) => (
              <article key={`${resource.locale}:${resource.key}`} className="rounded border p-3">
                <div className="font-medium">{resource.key}</div>
                <p className="text-sm">{resource.value}</p>
                {canManage ? (
                  <button
                    type="button"
                    className="mt-2 text-sm underline"
                    onClick={() => {
                      editResource(resource);
                    }}
                  >
                    Edit
                  </button>
                ) : null}
              </article>
            ))
          )}
        </div>

        {canManage ? (
          <div className="space-y-3 rounded border p-3">
            <h3 className="font-medium">Editor</h3>
            <label className="block space-y-1">
              <span className="text-sm">Key</span>
              <input
                className="w-full rounded border px-3 py-2"
                value={draftKey}
                onChange={(event) => {
                  setDraftKey(event.target.value);
                }}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm">Value (plain text)</span>
              <textarea
                className="min-h-24 w-full rounded border px-3 py-2"
                value={draftValue}
                onChange={(event) => {
                  setDraftValue(event.target.value);
                }}
              />
            </label>
            <button
              type="button"
              className="rounded border px-4 py-2"
              onClick={() => {
                void saveResource();
              }}
            >
              Save string
            </button>
          </div>
        ) : null}

        {message ? (
          <p role="status" aria-live="polite">
            {message}
            {requestId ? ` (Request ID: ${requestId})` : ""}
          </p>
        ) : null}
      </div>
    </section>
  );
}
