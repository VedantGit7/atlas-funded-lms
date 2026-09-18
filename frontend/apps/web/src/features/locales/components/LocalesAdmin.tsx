"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Archive,
  ClipboardCheck,
  FileText,
  Languages,
  LayoutDashboard,
  MessageSquareText,
} from "lucide-react";
import type { z } from "zod";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import type { localeResourceDtoSchema } from "@atlas/contracts/locales/locale.dto";
import {
  localesMainClassName,
  localesPanelHeaderClassName,
  localesRailButtonActiveClassName,
  localesRailButtonClassName,
  localesRailClassName,
  localesWorkspaceClassName,
} from "../locales-admin-shared";
import { LocalesStringsTab } from "./LocalesStringsTab";
import { LocalesOverviewTab } from "./tabs/LocalesOverviewTab";
import { LocalesLanguagesTab } from "./tabs/LocalesLanguagesTab";
import { LocalesReviewQueueTab } from "./tabs/LocalesReviewQueueTab";
import { LocalesQaChecksTab } from "./tabs/LocalesQaChecksTab";
import { LocalesImportExportTab } from "./tabs/LocalesImportExportTab";
import { cancellationFlag } from "@/lib/effect-cancellation";

type LocaleResourceDto = z.infer<typeof localeResourceDtoSchema>;

export type LocalesTabId = "overview" | "languages" | "strings" | "review" | "qa" | "import-export";

type LocalesAdminProps = {
  initialResources?: LocaleResourceDto[];
  canManage?: boolean;
  organizationLabel?: string;
};

const TABS: Array<{
  id: LocalesTabId;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "languages", label: "Languages", icon: Languages },
  { id: "strings", label: "Strings & Translations", icon: FileText },
  { id: "review", label: "Review Queue", icon: MessageSquareText },
  { id: "qa", label: "QA Checks", icon: ClipboardCheck },
  { id: "import-export", label: "Import / Export", icon: Archive },
];

export function LocalesAdmin({
  initialResources,
  canManage = true,
  organizationLabel = "Your organization",
}: LocalesAdminProps) {
  const [activeTab, setActiveTab] = useState<LocalesTabId>("strings");
  const [resources, setResources] = useState<LocaleResourceDto[]>(initialResources ?? []);
  const [loading, setLoading] = useState(initialResources === undefined);
  const [authDenied, setAuthDenied] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadRequestId, setLoadRequestId] = useState<string | null>(null);

  const refreshResources = useCallback(async () => {
    const response = await clientApi.get<{ data: LocaleResourceDto[] }>("/api/v1/locales");
    setResources(response.data);
    return response.data;
  }, []);

  useEffect(() => {
    if (initialResources !== undefined) return;
    const effect = cancellationFlag();
    void (async () => {
      try {
        await refreshResources();
      } catch (error) {
        if (effect.isCancelled()) return;
        if (error instanceof ClientApiError && (error.status === 401 || error.status === 403)) {
          setAuthDenied(true);
          return;
        }
        if (error instanceof ClientApiError) {
          setLoadError(error.message);
          setLoadRequestId(error.requestId);
          return;
        }
        setLoadError("Failed to load locale resources.");
      } finally {
        if (!effect.isCancelled()) setLoading(false);
      }
    })();
    return () => {
      effect.cancel();
    };
  }, [initialResources, refreshResources]);

  if (authDenied) {
    return (
      <section className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-8 text-center">
        <p className="text-sm text-[var(--admin-on-surface-variant)]">
          You do not have permission to view locale resources for {organizationLabel}.
        </p>
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-8 text-center">
        <p className="text-sm text-[var(--admin-danger)]">{loadError}</p>
        {loadRequestId ? (
          <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">
            Request ID: {loadRequestId}
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <section className={localesWorkspaceClassName} aria-label="Locales and translations">
      <nav className={localesRailClassName} aria-label="Locales sections">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              title={tab.label}
              aria-label={tab.label}
              aria-current={isActive ? "page" : undefined}
              className={`${localesRailButtonClassName} ${isActive ? localesRailButtonActiveClassName : ""}`}
              onClick={() => {
                setActiveTab(tab.id);
              }}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
            </button>
          );
        })}
      </nav>

      <div className={localesMainClassName}>
        <header className={localesPanelHeaderClassName}>
          <h1 className="text-xl font-semibold text-[var(--admin-on-surface)]">
            Locales &amp; Translations
          </h1>
          <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
            Manage tenant locale string overrides with sanitized plain text values.
          </p>
        </header>

        {activeTab === "overview" ? <LocalesOverviewTab canManage={canManage} /> : null}
        {activeTab === "languages" ? <LocalesLanguagesTab canManage={canManage} /> : null}
        {activeTab === "strings" ? (
          <LocalesStringsTab
            resources={resources}
            onResourcesChange={setResources}
            canManage={canManage}
            loading={loading}
          />
        ) : null}
        {activeTab === "review" ? <LocalesReviewQueueTab canManage={canManage} /> : null}
        {activeTab === "qa" ? <LocalesQaChecksTab canManage={canManage} /> : null}
        {activeTab === "import-export" ? <LocalesImportExportTab canManage={canManage} /> : null}
      </div>
    </section>
  );
}
