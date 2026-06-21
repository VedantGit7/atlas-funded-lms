import Link from "next/link";
import type { MembersListResponse } from "@atlas/membership";
import type { RoleListResponse } from "@atlas/domain-access/schemas/access-admin";
import { serverApi } from "../../lib/server-api";

export default async function AdminDashboardPage() {
  let memberCount = 0;
  let roleCount = 0;
  let loadError: string | null = null;

  try {
    const [members, roles] = await Promise.all([
      serverApi.get<MembersListResponse>("/api/v1/members?limit=1"),
      serverApi.get<RoleListResponse>("/api/v1/roles?limit=1"),
    ]);

    memberCount = members.data.items.length > 0 ? (members.data.pageInfo.hasNextPage ? 2 : 1) : 0;
    roleCount = roles.data.items.length;
    if (roles.data.pageInfo.hasNextPage) {
      roleCount = Math.max(roleCount, 2);
    }
  } catch {
    loadError = "Some admin summary data could not be loaded.";
  }

  return (
    <main className="space-y-6">
      <header>
        <h1>Admin Dashboard</h1>
        <p>Basic operating summary for tenant administration.</p>
      </header>

      {loadError ? <p role="alert">{loadError}</p> : null}

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded border p-4">
          <h2>Members</h2>
          <p>
            {memberCount > 0 ? "Members are configured for this tenant." : "No members listed yet."}
          </p>
          <Link href="/admin/members">Manage members</Link>
        </article>

        <article className="rounded border p-4">
          <h2>Roles & Permissions</h2>
          <p>{roleCount} role(s) visible in the tenant catalogue.</p>
          <Link href="/admin/roles">Manage roles</Link>
        </article>

        <article className="rounded border p-4">
          <h2>Competency & Scoring</h2>
          <p>Configure dimensions, scoring profiles, bands, and publish versioned config.</p>
          <Link href="/admin/competency">Open competency config</Link>
        </article>

        <article className="rounded border p-4">
          <h2>Readiness Policy</h2>
          <p>Configure CTA prominence rules, legal copy, and outbound redirect target.</p>
          <Link href="/admin/readiness-policy">Open readiness policy</Link>
        </article>

        <article className="rounded border p-4">
          <h2>Gamification</h2>
          <p>Configure badges, leaderboards, and manual badge awards.</p>
          <Link href="/admin/gamification">Open gamification config</Link>
        </article>
        <article className="rounded border p-4">
          <h2>Notification Templates</h2>
          <p>Configure in-app and email templates for approved system events.</p>
          <Link href="/admin/notifications/templates">Manage notification templates</Link>
        </article>

        <article className="rounded border p-4">
          <h2>Automation Rules</h2>
          <p>Configure event-driven IF/THEN rules using approved triggers and actions.</p>
          <Link href="/admin/automation">Manage automation rules</Link>
        </article>

        <article className="rounded border p-4">
          <h2>Locales</h2>
          <p>Manage tenant locale string overrides for approved UI copy.</p>
          <Link href="/admin/locales">Manage locales</Link>
        </article>

        <article className="rounded border p-4">
          <h2>Analytics</h2>
          <p>Review tenant learning metrics, funnel stages, and assessment item performance.</p>
          <Link href="/admin/analytics">Open analytics</Link>
        </article>
      </section>
    </main>
  );
}
