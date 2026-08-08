"use client";

import { useEffect, useState } from "react";
import { platformApi } from "../platform-api";
import { usePlatformReason } from "./PlatformReasonProvider";
import { PlatformReasonDialog, PlatformReasonGate } from "./PlatformReasonDialog";
import type { PlatformCapabilityProjection } from "../platform-capability-projection";
import {
  PlatformEntitlementEditor,
  entitlementDraftToApi,
  entitlementFromApi,
  type EntitlementDraft,
} from "./PlatformEntitlementEditor";

type TenantDetail = {
  id: string;
  slug: string;
  displayName: string;
  state: string;
  defaultLocale: string;
  defaultTimezone: string;
  primaryDomain: { hostname: string; status: string } | null;
  provisioning: { latestStatus: string | null };
};

type ProvisioningJob = {
  id: string;
  status: string;
  step: string | null;
  safeErrorMessage: string | null;
  createdAt: string;
};

export function PlatformTenantDetailClient({
  tenantId,
  capabilities,
}: {
  tenantId: string;
  capabilities: PlatformCapabilityProjection;
}) {
  const { reason, isValid } = usePlatformReason();
  const [tab, setTab] = useState<"overview" | "lifecycle" | "provisioning" | "entitlements">(
    "overview",
  );
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [jobs, setJobs] = useState<ProvisioningJob[]>([]);
  const [entitlements, setEntitlements] = useState<EntitlementDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogKind, setDialogKind] = useState<"lifecycle" | "entitlements" | null>(null);
  const [pendingAction, setPendingAction] = useState<"suspend" | "resume" | "archive" | null>(
    null,
  );
  const [actionReason, setActionReason] = useState("");

  useEffect(() => {
    if (!isValid || !reason) return;

    let cancelled = false;
    setError(null);

    Promise.all([
      platformApi.get<{ data: TenantDetail }>(`/api/v1/platform/tenants/${tenantId}`, reason),
      platformApi.get<{ data: ProvisioningJob[] }>(
        `/api/v1/platform/tenants/${tenantId}/provisioning`,
        reason,
      ),
      capabilities.canEntitlementManage
        ? platformApi.get<{
            data: Array<{
              key: string;
              enabled: boolean;
              value: unknown;
              expiresAt: string | null;
            }>;
          }>(`/api/v1/platform/tenants/${tenantId}/entitlements`, reason)
        : Promise.resolve({ data: [] }),
    ])
      .then(([detail, provisioning, entitlementResponse]) => {
        if (!cancelled) {
          setTenant(detail.data);
          setJobs(provisioning.data);
          setEntitlements(entitlementResponse.data.map(entitlementFromApi));
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Request failed.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [tenantId, isValid, reason, capabilities.canEntitlementManage]);

  async function runLifecycle(action: "suspend" | "resume" | "archive") {
    if (!reason) return;

    await platformApi.post(
      `/api/v1/platform/tenants/${tenantId}/${action}`,
      { reason: actionReason },
      reason,
      `platform-${action}`,
    );
    const refreshed = await platformApi.get<{ data: TenantDetail }>(
      `/api/v1/platform/tenants/${tenantId}`,
      reason,
    );
    setTenant(refreshed.data);
    setDialogOpen(false);
    setDialogKind(null);
    setPendingAction(null);
    setActionReason("");
  }

  async function saveEntitlements() {
    if (!reason) return;

    const payload = entitlements
      .filter((row) => row.key.trim().length > 0)
      .map(entitlementDraftToApi);

    await platformApi.put(
      `/api/v1/platform/tenants/${tenantId}/entitlements`,
      { entitlements: payload, reason: actionReason },
      reason,
      "platform-entitlements",
    );
    setDialogOpen(false);
    setDialogKind(null);
    setActionReason("");
  }

  const canLifecycle = capabilities.canTenantManage;
  const canEntitlements = capabilities.canEntitlementManage;
  const state = tenant?.state ?? "";
  const canSuspend = state === "ACTIVE" || state === "PROVISIONING";
  const canResume = state === "SUSPENDED";
  const canArchive = state !== "ARCHIVED" && state !== "DELETED";

  return (
    <PlatformReasonGate ready={isValid}>
      <section className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">{tenant?.displayName ?? "Tenant detail"}</h1>
          <p className="text-sm opacity-70">{tenant?.slug}</p>
        </div>

        {error ? (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2" role="tablist">
          {(["overview", "lifecycle", "provisioning", "entitlements"] as const).map((value) => {
            if (value === "lifecycle" && !canLifecycle) return null;
            if (value === "entitlements" && !canEntitlements) return null;
            return (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                className={`rounded border px-3 py-1 text-sm ${
                  tab === value ? "bg-neutral-900 text-white" : ""
                }`}
                onClick={() => {
                  setTab(value);
                }}
              >
                {value[0]?.toUpperCase()}
                {value.slice(1)}
              </button>
            );
          })}
        </div>

        {tab === "overview" && tenant ? (
          <dl className="grid gap-3 text-sm md:grid-cols-2">
            <div>
              <dt className="opacity-70">State</dt>
              <dd>{tenant.state}</dd>
            </div>
            <div>
              <dt className="opacity-70">Provisioning</dt>
              <dd>{tenant.provisioning.latestStatus ?? "—"}</dd>
            </div>
            <div>
              <dt className="opacity-70">Primary host</dt>
              <dd>
                {tenant.primaryDomain
                  ? `${tenant.primaryDomain.hostname} (${tenant.primaryDomain.status})`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="opacity-70">Locale</dt>
              <dd>{tenant.defaultLocale}</dd>
            </div>
            <div>
              <dt className="opacity-70">Timezone</dt>
              <dd>{tenant.defaultTimezone}</dd>
            </div>
          </dl>
        ) : null}

        {tab === "lifecycle" && tenant && canLifecycle ? (
          <div className="space-y-3">
            <p className="text-sm">Current state: {tenant.state}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded border px-3 py-2 text-sm disabled:opacity-50"
                disabled={!canSuspend}
                onClick={() => {
                  setPendingAction("suspend");
                  setDialogKind("lifecycle");
                  setDialogOpen(true);
                }}
              >
                Suspend
              </button>
              <button
                type="button"
                className="rounded border px-3 py-2 text-sm disabled:opacity-50"
                disabled={!canResume}
                onClick={() => {
                  setPendingAction("resume");
                  setDialogKind("lifecycle");
                  setDialogOpen(true);
                }}
              >
                Resume
              </button>
              <button
                type="button"
                className="rounded border px-3 py-2 text-sm disabled:opacity-50"
                disabled={!canArchive}
                onClick={() => {
                  setPendingAction("archive");
                  setDialogKind("lifecycle");
                  setDialogOpen(true);
                }}
              >
                Archive
              </button>
            </div>
          </div>
        ) : null}

        {tab === "provisioning" ? (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Step</th>
                <th className="py-2 pr-4">Error</th>
                <th className="py-2">Updated</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-b">
                  <td className="py-2 pr-4">{job.status}</td>
                  <td className="py-2 pr-4">{job.step ?? "—"}</td>
                  <td className="py-2 pr-4">{job.safeErrorMessage ?? "—"}</td>
                  <td className="py-2">{new Date(job.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}

        {tab === "entitlements" && canEntitlements ? (
          <div className="space-y-3">
            <PlatformEntitlementEditor entitlements={entitlements} onChange={setEntitlements} />
            <button
              type="button"
              className="rounded bg-neutral-900 px-3 py-2 text-sm text-white"
              onClick={() => {
                setDialogKind("entitlements");
                setPendingAction(null);
                setActionReason("");
                setDialogOpen(true);
              }}
            >
              Save entitlements
            </button>
          </div>
        ) : null}
      </section>

      <PlatformReasonDialog
        open={dialogOpen}
        title={
          dialogKind === "entitlements"
            ? "Confirm entitlement changes"
            : `Confirm tenant ${pendingAction ?? "action"}`
        }
        description="This action requires an operational reason of at least 10 characters."
        value={actionReason}
        onChange={setActionReason}
        onConfirm={() => {
          if (dialogKind === "lifecycle" && pendingAction) {
            void runLifecycle(pendingAction);
            return;
          }
          if (dialogKind === "entitlements") {
            void saveEntitlements();
          }
        }}
        onCancel={() => {
          setDialogOpen(false);
          setDialogKind(null);
          setPendingAction(null);
        }}
      />
    </PlatformReasonGate>
  );
}
