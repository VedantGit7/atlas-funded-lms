"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Input, Skeleton } from "@atlas/design-system";
import { ClientApiError, clientApi } from "../../../../lib/client-api";
import {
  fieldClassName,
  localesAlertErrorClassName,
  localesAlertSuccessClassName,
  localesPrimaryButtonClassName,
  localesTableHeadClassName,
  localesTableRowClassName,
  localesTableShellClassName,
} from "../../locales-admin-shared";
import { LocalePicker } from "../LocalePicker";

type LocaleMetadataDto = {
  locale: string;
  nativeName: string | null;
  isRtl: boolean;
  isDefault: boolean;
  isFallback: boolean;
  updatedAt: string;
};

type LocalesLanguagesTabProps = {
  canManage: boolean;
};

export function LocalesLanguagesTab({ canManage }: LocalesLanguagesTabProps) {
  const [metadata, setMetadata] = useState<LocaleMetadataDto[]>([]);
  const [selectedLocale, setSelectedLocale] = useState("en");
  const [nativeName, setNativeName] = useState("");
  const [isRtl, setIsRtl] = useState(false);
  const [isDefault, setIsDefault] = useState(false);
  const [isFallback, setIsFallback] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"error" | "success">("error");

  const existingLocales = useMemo(() => metadata.map((entry) => entry.locale), [metadata]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await clientApi.get<{ data: LocaleMetadataDto[] }>(
        "/api/v1/locales/metadata",
      );
      setMetadata(response.data);
    } catch (caught) {
      setMessage(caught instanceof ClientApiError ? caught.message : "Failed to load metadata.");
      setMessageTone("error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const entry = metadata.find((row) => row.locale === selectedLocale);
    setNativeName(entry?.nativeName ?? "");
    setIsRtl(entry?.isRtl ?? false);
    setIsDefault(entry?.isDefault ?? false);
    setIsFallback(entry?.isFallback ?? false);
  }, [metadata, selectedLocale]);

  async function saveMetadata() {
    if (!canManage) return;
    setSaving(true);
    setMessage(null);
    try {
      const response = await clientApi.put<{ data: LocaleMetadataDto }>(
        `/api/v1/locales/metadata/${selectedLocale}`,
        {
          nativeName: nativeName.trim() || null,
          isRtl,
          isDefault,
          isFallback,
        },
        `locale-metadata-${selectedLocale}`,
      );
      setMetadata((current) => {
        const without = current.filter((entry) => entry.locale !== response.data.locale);
        return [...without, response.data].sort((a, b) => a.locale.localeCompare(b.locale));
      });
      setMessage("Language metadata saved.");
      setMessageTone("success");
      await load();
    } catch (caught) {
      setMessage(caught instanceof ClientApiError ? caught.message : "Failed to save metadata.");
      setMessageTone("error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 p-6" aria-hidden="true">
        <Skeleton className="h-10 w-full bg-[var(--admin-surface-high)]" />
        <Skeleton className="h-40 w-full bg-[var(--admin-surface-high)]" />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
      {message ? (
        <div
          role="alert"
          className={
            messageTone === "success" ? localesAlertSuccessClassName : localesAlertErrorClassName
          }
        >
          {message}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className={localesTableShellClassName}>
          <div className="border-b border-[var(--admin-border)] px-4 py-3">
            <h2 className="text-sm font-semibold text-[var(--admin-on-surface)]">
              Configured languages
            </h2>
          </div>
          {metadata.length === 0 ? (
            <p className="p-4 text-sm text-[var(--admin-on-surface-variant)]">
              No metadata yet. Configure a locale on the right.
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className={`${localesTableRowClassName} hover:bg-transparent`}>
                  <th className={`${localesTableHeadClassName} px-4 py-2`}>Locale</th>
                  <th className={`${localesTableHeadClassName} px-4 py-2`}>Native name</th>
                  <th className={`${localesTableHeadClassName} px-4 py-2`}>Flags</th>
                </tr>
              </thead>
              <tbody>
                {metadata.map((entry) => (
                  <tr
                    key={entry.locale}
                    className={`${localesTableRowClassName} cursor-pointer`}
                    onClick={() => {
                      setSelectedLocale(entry.locale);
                    }}
                  >
                    <td className="px-4 py-3 font-mono text-[var(--admin-on-surface)]">
                      {entry.locale}
                    </td>
                    <td className="px-4 py-3 text-[var(--admin-on-surface)]">
                      {entry.nativeName ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--admin-on-surface-variant)]">
                      {[
                        entry.isDefault ? "default" : null,
                        entry.isFallback ? "fallback" : null,
                        entry.isRtl ? "rtl" : null,
                      ]
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <section className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-[var(--admin-on-surface)]">
            Edit language metadata
          </h2>
          {!canManage ? (
            <p className="mt-2 text-sm text-[var(--admin-on-surface-variant)]">Read-only access.</p>
          ) : null}
          <div className="mt-4 space-y-4">
            <LocalePicker
              value={selectedLocale}
              onChange={setSelectedLocale}
              existingLocales={existingLocales}
            />
            <div className="space-y-1.5">
              <label
                htmlFor="locale-native-name"
                className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]"
              >
                Native name
              </label>
              <Input
                id="locale-native-name"
                value={nativeName}
                onChange={(event) => {
                  setNativeName(event.target.value);
                }}
                className={fieldClassName}
                disabled={!canManage || saving}
              />
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-[var(--admin-on-surface)]">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isRtl}
                  onChange={(event) => {
                    setIsRtl(event.target.checked);
                  }}
                  disabled={!canManage || saving}
                />
                RTL
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(event) => {
                    setIsDefault(event.target.checked);
                  }}
                  disabled={!canManage || saving}
                />
                Default
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isFallback}
                  onChange={(event) => {
                    setIsFallback(event.target.checked);
                  }}
                  disabled={!canManage || saving}
                />
                Fallback
              </label>
            </div>
            {canManage ? (
              <Button
                className={localesPrimaryButtonClassName}
                disabled={saving}
                onClick={() => void saveMetadata()}
              >
                {saving ? "Saving…" : "Save metadata"}
              </Button>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
