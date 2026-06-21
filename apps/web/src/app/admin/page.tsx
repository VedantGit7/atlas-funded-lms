import Link from "next/link";
import type { AuditListResponse } from "@atlas/audit";
import type { MembersListResponse } from "@atlas/membership";
import type { RoleListResponse } from "@atlas/domain-access/schemas/access-admin";
import { AdminPageGate, PageHeader } from "../../components/patterns/AdminPageGate";
import { ServerApiError, serverApi } from "../../lib/server-api";

export default async function AdminDashboardPage() {
  let memberCount = 0;
  let roleCount = 0;
  let auditAvailable = false;
  let loadError: string | null = null;

  try {
    const [members, roles, audit] = await Promise.all([
      serverApi.get<MembersListResponse>("/api/v1/members?limit=1"),
      serverApi.get<RoleListResponse>("/api/v1/roles?limit=1"),
      serverApi
        .get<AuditListResponse>("/api/v1/audit?limit=1")
        .then(() => ({ ok: true as const }))
        .catch(() => ({ ok: false as const })),
    ]);

    memberCount = members.data.items.length > 0 ? (members.data.pageInfo.hasNextPage ? 2 : 1) : 0;
    roleCount = roles.data.items.length;
    if (roles.data.pageInfo.hasNextPage) {
      roleCount = Math.max(roleCount, 2);
    }
    auditAvailable = audit.ok;
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <AdminPageGate
          screenId="T1"
          state="denied"
          title="Admin Dashboard"
          deniedMessage="You do not have permission to view the admin dashboard."
        />
      );
    }
    loadError = "Some admin summary data could not be loaded.";
  }

  return (
    <AdminPageGate screenId="T1" state="ready" title="Admin Dashboard">
      <main className="space-y-6">
        <PageHeader
          title="Admin Dashboard"
          description="Operational health and setup shortcuts for tenant administration."
        />

        {loadError ? <p role="alert">{loadError}</p> : null}

        <section className="grid gap-4 md:grid-cols-2">
          <article className="rounded border p-4">
            <h2>Members</h2>
            <p>
              {memberCount > 0
                ? "Members are configured for this tenant."
                : "No members listed yet."}
            </p>
            <Link href="/admin/members">Manage members</Link>
          </article>

          <article className="rounded border p-4">
            <h2>Roles &amp; Permissions</h2>
            <p>{roleCount} role(s) visible in the tenant catalogue.</p>
            <Link href="/admin/roles">Manage roles</Link>
          </article>

          <article className="rounded border p-4">
            <h2>Audit</h2>
            <p>
              {auditAvailable
                ? "Recent tenant audit activity is available."
                : "Audit summary is unavailable for your current access."}
            </p>
            <Link href="/admin/audit">Open audit log</Link>
          </article>

          <article className="rounded border p-4">
            <h2>Configuration</h2>
            <p>Review runtime config, feature flags, and read-only entitlements.</p>
            <div className="flex flex-wrap gap-3">
              <Link href="/admin/config">Configuration</Link>
              <Link href="/admin/feature-flags">Feature flags</Link>
              <Link href="/admin/entitlements">Entitlements</Link>
              <Link href="/admin/competency">Competency</Link>
            </div>
          </article>

          <article className="rounded border p-4">
            <h2>Content &amp; Community</h2>
            <p>Use existing studio and moderation surfaces for content and community work.</p>
            <div className="flex flex-wrap gap-3">
              <Link href="/studio/courses">Studio content</Link>
              <Link href="/moderate/cases">Moderation queue</Link>
              <Link href="/review">Review &amp; approvals</Link>
            </div>
          </article>

          <article className="rounded border p-4">
            <h2>Data Rights</h2>
            <p>Run exports and review deletion requests using approved data-rights flows.</p>
            <div className="flex flex-wrap gap-3">
              <Link href="/admin/exports">Data exports</Link>
              <Link href="/admin/deletion-requests">Deletion requests</Link>
            </div>
          </article>
        </section>
      </main>
    </AdminPageGate>
  );
}
