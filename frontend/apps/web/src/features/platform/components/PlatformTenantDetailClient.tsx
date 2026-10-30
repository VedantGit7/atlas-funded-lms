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

type TenantDomain = {
  id: string;
  hostname: string;
  type: string;
  status: string;
  isPrimary: boolean;
  verification: { txtName: string; txtValue: string } | null;
  failureReason: string | null;
};

type DomainAction = { kind: "add" } | { kind: "verify" | "primary"; domain: TenantDomain };

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
  const [tab, setTab] = useState<
    "overview" | "lifecycle" | "domains" | "provisioning" | "entitlements"
  >("overview");
  const [domains, setDomains] = useState<TenantDomain[]>([]);
  const [newHostname, setNewHostname] = useState("");
  const [domainAction, setDomainAction] = useState<DomainAction | null>(null);
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [jobs, setJobs] = useState<ProvisioningJob[]>([]);
  const [entitlements, setEntitlements] = useState<EntitlementDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogKind, setDialogKind] = useState<
    "lifecycle" | "entitlements" | "owner-invitation" | "domain" | null
  >(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"suspend" | "resume" | "archive" | null>(null);
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
      platformApi.get<{ data: TenantDomain[] }>(
        `/api/v1/platform/tenants/${tenantId}/domains`,
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
      .then(([detail, provisioning, domainResponse, entitlementResponse]) => {
        if (!cancelled) {
          setTenant(detail.data);
          setJobs(provisioning.data);
          setDomains(domainResponse.data);
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

  async function sendOwnerInvitation() {
    if (!reason) return;
    setError(null);
    setNotice(null);
    try {
      const sent = await platformApi.post<{ data: { email: string; hostname: string } }>(
        `/api/v1/platform/tenants/${tenantId}/owner-invitation`,
        { reason: actionReason },
        reason,
        "platform-owner-invitation",
      );
      setNotice(`Owner invitation sent to ${sent.data.email}, linking to ${sent.data.hostname}.`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Request failed.");
    }
    setDialogOpen(false);
    setDialogKind(null);
    setActionReason("");
  }

  async function runDomainAction(action: DomainAction) {
    if (!reason) return;
    setError(null);
    setNotice(null);
    try {
      if (action.kind === "add") {
        const added = await platformApi.post<{ data: TenantDomain }>(
          `/api/v1/platform/tenants/${tenantId}/domains`,
          { hostname: newHostname, reason: actionReason },
          reason,
          "platform-domain-add",
        );
        setNewHostname("");
        setNotice(`Added ${added.data.hostname}. Create its TXT record, then verify it.`);
      } else if (action.kind === "verify") {
        const checked = await platformApi.post<{ data: TenantDomain }>(
          `/api/v1/platform/tenants/${tenantId}/domains/${action.domain.id}/verify`,
          { reason: actionReason },
          reason,
          "platform-domain-verify",
        );
        setNotice(
          checked.data.status === "ACTIVE"
            ? `${checked.data.hostname} is verified and active.`
            : `${checked.data.hostname} is not verified: ${checked.data.failureReason ?? "unknown reason"}`,
        );
      } else {
        await platformApi.post(
          `/api/v1/platform/tenants/${tenantId}/domains/${action.domain.id}/primary`,
          { reason: actionReason },
          reason,
          "platform-domain-primary",
        );
        setNotice(`${action.domain.hostname} is now the primary domain.`);
      }
      const [listed, detail] = await Promise.all([
        platformApi.get<{ data: TenantDomain[] }>(
          `/api/v1/platform/tenants/${tenantId}/domains`,
          reason,
        ),
        platformApi.get<{ data: TenantDetail }>(`/api/v1/platform/tenants/${tenantId}`, reason),
      ]);
      setDomains(listed.data);
      setTenant(detail.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Request failed.");
    }
    setDialogOpen(false);
    setDialogKind(null);
    setDomainAction(null);
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
          <p className="text-sm text-muted-foreground">{tenant?.slug}</p>
        </div>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="text-sm">
            {notice}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2" role="tablist">
          {(["overview", "lifecycle", "domains", "provisioning", "entitlements"] as const).map(
            (value) => {
              if (value === "lifecycle" && !canLifecycle) return null;
              if (value === "entitlements" && !canEntitlements) return null;
              return (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={tab === value}
                  className={`rounded border px-3 py-1 text-sm ${
                    tab === value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:bg-muted"
                  }`}
                  onClick={() => {
                    setTab(value);
                  }}
                >
                  {value[0]?.toUpperCase()}
                  {value.slice(1)}
                </button>
              );
            },
          )}
        </div>

        {tab === "overview" && tenant ? (
          <dl className="grid gap-3 text-sm md:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">State</dt>
              <dd>{tenant.state}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Provisioning</dt>
              <dd>{tenant.provisioning.latestStatus ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Primary host</dt>
              <dd>
                {tenant.primaryDomain
                  ? `${tenant.primaryDomain.hostname} (${tenant.primaryDomain.status})`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Locale</dt>
              <dd>{tenant.defaultLocale}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Timezone</dt>
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
                className="rounded border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
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
                className="rounded border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
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
                className="rounded border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
                disabled={!canArchive}
                onClick={() => {
                  setPendingAction("archive");
                  setDialogKind("lifecycle");
                  setDialogOpen(true);
                }}
              >
                Archive
              </button>
              <button
                type="button"
                className="rounded border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
                disabled={state !== "ACTIVE"}
                onClick={() => {
                  setPendingAction(null);
                  setDialogKind("owner-invitation");
                  setDialogOpen(true);
                }}
              >
                Send owner invitation
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Emails the owner a new invitation link to the tenant's live primary domain. Any
              earlier link stops working.
            </p>
          </div>
        ) : null}

        {tab === "domains" ? (
          <div className="space-y-4">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-2 pr-4">Domain</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Verification</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {domains.map((domain) => (
                  <tr key={domain.id} className="border-b border-border align-top">
                    <td className="py-2 pr-4">
                      {domain.hostname}
                      {domain.isPrimary ? " (primary)" : ""}
                      <div className="text-xs text-muted-foreground">{domain.type}</div>
                    </td>
                    <td className="py-2 pr-4">
                      {domain.status}
                      {domain.failureReason ? (
                        <div className="text-xs text-destructive">{domain.failureReason}</div>
                      ) : null}
                    </td>
                    <td className="py-2 pr-4 text-xs">
                      {domain.verification ? (
                        <>
                          <div>TXT name: {domain.verification.txtName}</div>
                          <div className="break-all">TXT value: {domain.verification.txtValue}</div>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2">
                      {canLifecycle && domain.verification ? (
                        <button
                          type="button"
                          className="mr-2 rounded border border-border px-2 py-1 text-xs hover:bg-muted"
                          onClick={() => {
                            setDomainAction({ kind: "verify", domain });
                            setDialogKind("domain");
                            setDialogOpen(true);
                          }}
                        >
                          Verify
                        </button>
                      ) : null}
                      {canLifecycle && domain.status === "ACTIVE" && !domain.isPrimary ? (
                        <button
                          type="button"
                          className="rounded border border-border px-2 py-1 text-xs hover:bg-muted"
                          onClick={() => {
                            setDomainAction({ kind: "primary", domain });
                            setDialogKind("domain");
                            setDialogOpen(true);
                          }}
                        >
                          Make primary
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {canLifecycle ? (
              <form
                className="flex flex-wrap items-end gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  setDomainAction({ kind: "add" });
                  setDialogKind("domain");
                  setDialogOpen(true);
                }}
              >
                <label className="text-sm">
                  Custom domain
                  <input
                    className="ml-2 rounded border border-border px-2 py-1"
                    placeholder="academy.example.com"
                    value={newHostname}
                    onChange={(event) => {
                      setNewHostname(event.target.value);
                    }}
                    required
                  />
                </label>
                <button
                  type="submit"
                  className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground hover:opacity-90"
                >
                  Add domain
                </button>
              </form>
            ) : null}
            <p className="text-xs text-muted-foreground">
              A custom domain goes live once its TXT record is verified. Make it primary so
              invitation and email links use it.
            </p>
          </div>
        ) : null}

        {tab === "provisioning" ? (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Step</th>
                <th className="py-2 pr-4">Error</th>
                <th className="py-2">Updated</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-b border-border">
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
              className="rounded bg-primary px-3 py-2 text-sm text-primary-foreground hover:opacity-90"
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
            : dialogKind === "owner-invitation"
              ? "Send owner invitation"
              : dialogKind === "domain"
                ? domainAction?.kind === "add"
                  ? `Add ${newHostname}`
                  : domainAction?.kind === "verify"
                    ? `Verify ${domainAction.domain.hostname}`
                    : `Make ${domainAction?.domain.hostname ?? "domain"} primary`
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
          if (dialogKind === "owner-invitation") {
            void sendOwnerInvitation();
          }
          if (dialogKind === "domain" && domainAction) {
            void runDomainAction(domainAction);
          }
        }}
        onCancel={() => {
          setDialogOpen(false);
          setDialogKind(null);
          setPendingAction(null);
          setDomainAction(null);
        }}
      />
    </PlatformReasonGate>
  );
}
