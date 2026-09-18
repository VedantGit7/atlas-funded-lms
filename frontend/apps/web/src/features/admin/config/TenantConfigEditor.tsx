"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AlertTriangle, Clock, CloudOff, RefreshCw, Rocket } from "lucide-react";
import { AdminConfirmDialog } from "../../../components/shells/admin/AdminConfirmDialog";
import {
  BrandingAnimatedCollapsible,
  BrandingSegmentedControl,
  cardClassName,
  formatRelativeUpdatedAt,
  ghostButtonClassName,
  outlineButtonClassName,
  primaryButtonClassName,
  statusBannerClassName,
} from "../../../app/admin/branding/_components/branding-admin-shared";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import { requestSearchReindex } from "../../search/api";
import { ConfigJsonEditor } from "./ConfigJsonEditor";
import { ConfigSectionForm } from "./ConfigSectionForm";
import { tabButtonClassName } from "./config-admin-shared";
import {
  canRenderAsForm,
  isPlainObject,
  parseJsonDraft,
  type JsonParseResult,
} from "./config-json-utils";
import {
  TENANT_CONFIG_SECTIONS,
  mergeConfigSection,
  pickConfigSection,
  type TenantConfigSectionKey,
} from "./tenant-config-sections";

type TenantConfigEditorProps = {
  initialConfigJson: Record<string, unknown>;
  version: number;
  updatedAt: string;
  canPublish: boolean;
};

type EditorTab = TenantConfigSectionKey | "advanced";
type SectionEditorMode = "form" | "json";

function formatError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Request failed.";
}

export function TenantConfigEditor({
  initialConfigJson,
  version,
  updatedAt,
  canPublish,
}: TenantConfigEditorProps) {
  const router = useRouter();
  const [configJson, setConfigJson] = useState(initialConfigJson);
  const [activeTab, setActiveTab] = useState<EditorTab>("proctoring");
  const [sectionMode, setSectionMode] = useState<SectionEditorMode>("form");
  const [sectionDraft, setSectionDraft] = useState(
    JSON.stringify(pickConfigSection(initialConfigJson, "proctoring"), null, 2),
  );
  const [advancedDraft, setAdvancedDraft] = useState(JSON.stringify(initialConfigJson, null, 2));
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);

  const sectionLabel = useMemo(
    () => TENANT_CONFIG_SECTIONS.find((section) => section.key === activeTab)?.label ?? "Section",
    [activeTab],
  );

  const activeParseResult: JsonParseResult | null = useMemo(() => {
    if (activeTab === "advanced") return parseJsonDraft(advancedDraft);
    if (sectionMode === "json") return parseJsonDraft(sectionDraft);
    return null;
  }, [activeTab, advancedDraft, sectionDraft, sectionMode]);

  const hasParseError = activeParseResult != null && !activeParseResult.ok;
  const isDirty = JSON.stringify(configJson) !== JSON.stringify(initialConfigJson);

  const sectionObject = useMemo(() => {
    if (activeTab === "advanced") return null;
    if (sectionMode === "form" && activeParseResult?.ok && isPlainObject(activeParseResult.value)) {
      return activeParseResult.value;
    }
    const parsed = parseJsonDraft(sectionDraft);
    return parsed.ok && isPlainObject(parsed.value)
      ? parsed.value
      : pickConfigSection(configJson, activeTab);
  }, [activeParseResult, activeTab, configJson, sectionDraft, sectionMode]);

  function resolveNextConfig(): Record<string, unknown> | null {
    if (activeTab === "advanced") {
      const parsed = parseJsonDraft(advancedDraft);
      if (!parsed.ok) {
        setMessage("Fix JSON syntax in the advanced editor before continuing.");
        return null;
      }
      if (!isPlainObject(parsed.value)) {
        setMessage("Configuration must be a JSON object.");
        return null;
      }
      return parsed.value;
    }

    if (sectionMode === "json") {
      const parsed = parseJsonDraft(sectionDraft);
      if (!parsed.ok) {
        setMessage("Fix JSON syntax in the current section before continuing.");
        return null;
      }
      if (!isPlainObject(parsed.value)) {
        setMessage("Section JSON must be an object.");
        return null;
      }
      return mergeConfigSection(configJson, activeTab, parsed.value);
    }

    if (!sectionObject) return configJson;
    return mergeConfigSection(configJson, activeTab, sectionObject);
  }

  function switchTab(tab: EditorTab) {
    if (tab === activeTab) return;

    const nextConfig = resolveNextConfig();
    if (!nextConfig) return;

    setConfigJson(nextConfig);
    setActiveTab(tab);
    setMessage(null);

    if (tab === "advanced") {
      setAdvancedDraft(JSON.stringify(nextConfig, null, 2));
      return;
    }

    const sectionValue = pickConfigSection(nextConfig, tab);
    setSectionDraft(JSON.stringify(sectionValue, null, 2));
    setSectionMode(canRenderAsForm(sectionValue) ? "form" : "json");
  }

  async function persistConfig(nextConfig: Record<string, unknown>) {
    setBusy(true);
    setMessage(null);
    try {
      await clientApi.put("/api/v1/config", { configJson: nextConfig }, "config-update");
      setConfigJson(nextConfig);
      router.refresh();
    } catch (error) {
      setMessage(formatError(error));
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft() {
    const nextConfig = resolveNextConfig();
    if (!nextConfig) return;
    await persistConfig(nextConfig);
  }

  async function publishConfig() {
    const nextConfig = resolveNextConfig();
    if (!nextConfig) return;

    setBusy(true);
    setMessage(null);
    try {
      if (JSON.stringify(nextConfig) !== JSON.stringify(configJson)) {
        await clientApi.put("/api/v1/config", { configJson: nextConfig }, "config-update");
        setConfigJson(nextConfig);
      }
      await clientApi.post("/api/v1/config/publish", {}, "config-publish");
      setConfirmPublish(false);
      router.refresh();
    } catch (error) {
      setMessage(formatError(error));
    } finally {
      setBusy(false);
    }
  }

  async function triggerSearchReindex() {
    setBusy(true);
    setMessage(null);
    try {
      await requestSearchReindex("search-reindex-admin");
    } catch (error) {
      setMessage(formatError(error));
    } finally {
      setBusy(false);
    }
  }

  function discardChanges() {
    const tabKey = activeTab === "advanced" ? "proctoring" : activeTab;
    setConfigJson(initialConfigJson);
    setSectionDraft(JSON.stringify(pickConfigSection(initialConfigJson, tabKey), null, 2));
    setAdvancedDraft(JSON.stringify(initialConfigJson, null, 2));
    setMessage("Unsaved changes discarded.");
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-[var(--admin-border)] pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--admin-on-surface)] sm:text-3xl">
            Configuration
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
            Edit tenant runtime configuration and publish approved versions.
          </p>
        </div>
        <div className="text-left lg:text-right">
          <span className="inline-flex items-center rounded-full bg-[var(--admin-primary-container)] px-3 py-1 text-xs font-bold text-[var(--admin-on-primary-container)]">
            Draft v{version}
          </span>
          <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-[var(--admin-on-surface-variant)]">
            <Clock className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
            Last updated {formatRelativeUpdatedAt(updatedAt)}
          </p>
        </div>
      </header>

      <BrandingAnimatedCollapsible open={Boolean(message)} id="config-status-banner">
        {message ? (
          <p
            role="status"
            className={`${statusBannerClassName} border-[var(--admin-success)]/30 bg-[var(--admin-success)]/10 text-[var(--admin-success)]`}
          >
            {message}
          </p>
        ) : null}
      </BrandingAnimatedCollapsible>

      <section className={cardClassName}>
        <div className="flex items-center gap-1 overflow-x-auto border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)]/40 px-4">
          <nav
            className="flex min-w-0 flex-1 gap-1 overflow-x-auto py-1"
            aria-label="Configuration sections"
          >
            {TENANT_CONFIG_SECTIONS.map((section) => (
              <button
                key={section.key}
                type="button"
                onClick={() => {
                  switchTab(section.key);
                }}
                className={tabButtonClassName(activeTab === section.key)}
              >
                {section.label}
              </button>
            ))}
          </nav>
          <button
            type="button"
            onClick={() => {
              switchTab("advanced");
            }}
            className={tabButtonClassName(activeTab === "advanced")}
          >
            Advanced
          </button>
        </div>

        <div className="space-y-4 p-6">
          {activeTab === "advanced" ? (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">
                  Full runtime configuration
                </h3>
                <span className="rounded-full border border-[var(--admin-warning)]/30 bg-[var(--admin-warning)]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--admin-warning)]">
                  Advanced
                </span>
              </div>
              <div className="flex gap-3 rounded-lg border border-[var(--admin-warning)]/40 bg-[var(--admin-warning)]/10 p-4">
                <AlertTriangle
                  className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-warning)]"
                  aria-hidden="true"
                />
                <p className="text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
                  You are editing the full configuration object. Changes here overwrite all section
                  settings at once. Validate carefully before saving.
                </p>
              </div>
              <ConfigJsonEditor
                value={advancedDraft}
                onChange={setAdvancedDraft}
                parseResult={activeParseResult}
                label="Full tenant configuration JSON editor"
                minLines={18}
                variant="advanced"
              />
            </>
          ) : (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[13px] font-bold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
                    {sectionLabel} settings
                  </h3>
                  <span className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-2 py-0.5 font-mono text-[10px] uppercase text-[var(--admin-on-surface-variant)]">
                    {sectionMode === "form" ? "Form" : "JSON"}
                  </span>
                </div>
                <div className="w-full max-w-[200px]">
                  <BrandingSegmentedControl
                    value={sectionMode}
                    ariaLabel={`${sectionLabel} editor mode`}
                    options={[
                      { id: "form", label: "Form" },
                      { id: "json", label: "JSON" },
                    ]}
                    onChange={(mode) => {
                      if (mode === "json") {
                        if (sectionObject) {
                          setSectionDraft(JSON.stringify(sectionObject, null, 2));
                        }
                        setSectionMode("json");
                        return;
                      }
                      const parsed = parseJsonDraft(sectionDraft);
                      if (
                        parsed.ok &&
                        isPlainObject(parsed.value) &&
                        canRenderAsForm(parsed.value)
                      ) {
                        setSectionMode("form");
                        return;
                      }
                      setMessage("Switch to form view only when section JSON uses simple fields.");
                    }}
                  />
                </div>
              </div>

              {sectionMode === "form" && sectionObject ? (
                <ConfigSectionForm
                  value={sectionObject}
                  onChange={(next) => {
                    setSectionDraft(JSON.stringify(next, null, 2));
                  }}
                />
              ) : (
                <ConfigJsonEditor
                  value={sectionDraft}
                  onChange={setSectionDraft}
                  parseResult={activeParseResult}
                  label={`${sectionLabel} configuration JSON editor`}
                />
              )}
            </>
          )}
        </div>

        <div className="flex flex-col gap-4 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)]/30 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                void triggerSearchReindex();
              }}
              className={`${outlineButtonClassName} inline-flex items-center gap-2 border-transparent !px-2 hover:bg-[var(--admin-primary)]/5`}
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Reindex search
            </button>
            {isDirty ? (
              <p className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--admin-on-surface-variant)]">
                <CloudOff className="h-3.5 w-3.5" aria-hidden="true" />
                Changes unsaved
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={busy || !isDirty}
              onClick={discardChanges}
              className={ghostButtonClassName}
            >
              Discard changes
            </button>
            <button
              type="button"
              disabled={busy || hasParseError}
              onClick={() => {
                void saveDraft();
              }}
              className={outlineButtonClassName}
            >
              {busy ? "Saving…" : "Save draft"}
            </button>
            {canPublish ? (
              <button
                type="button"
                disabled={busy || hasParseError}
                onClick={() => {
                  setConfirmPublish(true);
                }}
                className={primaryButtonClassName}
              >
                Publish
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <AdminConfirmDialog
        open={confirmPublish}
        title="Publish configuration?"
        description="This applies the current draft to the live tenant runtime. Learners and integrations may pick up changes immediately."
        confirmLabel="Publish"
        busyLabel="Publishing…"
        icon={Rocket}
        tone="primary"
        busy={busy}
        onConfirm={() => {
          void publishConfig();
        }}
        onCancel={() => {
          setConfirmPublish(false);
        }}
      />
    </div>
  );
}
