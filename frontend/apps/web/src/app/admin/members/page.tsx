import type { ReactNode } from "react";
import { Activity, GraduationCap, MailPlus, Users } from "lucide-react";
import type {
  MemberStatsResponse,
  MembersListResponse,
} from "@atlas/contracts/membership/schemas/admin-members";
import type { RoleListResponse } from "@atlas/domain-access/schemas/access-admin";
import { AdminPageGate } from "../../../components/patterns/AdminPageGate";
import { InviteMemberDialog } from "../../../features/admin/members/InviteMemberDialog";
import { MembersTable, type RoleOption } from "../../../features/admin/members/MembersTable";
import { ServerApiError, serverApi } from "../../../lib/server-api";

const PAGE_SIZE = 20;

async function softGet<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch {
    return null;
  }
}

function MetricCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
          {label}
        </p>
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--admin-primary)]/12 text-[var(--admin-primary)]">
          {icon}
        </span>
      </div>
      <p className="mt-3 text-3xl font-bold text-[var(--admin-on-surface)]">{value}</p>
      <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">{hint}</p>
    </div>
  );
}

function MembersMetrics({ stats }: { stats: MemberStatsResponse["data"] }) {
  const completion =
    stats.courseCompletionRate === null
      ? "No data"
      : `${String(Math.round(stats.courseCompletionRate * 100))}%`;

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        icon={<Users className="h-5 w-5" aria-hidden="true" />}
        label="Total members"
        value={stats.totalMembers.toLocaleString()}
        hint={`${String(stats.activeMembers)} active`}
      />
      <MetricCard
        icon={<Activity className="h-5 w-5" aria-hidden="true" />}
        label="Active now"
        value={stats.activeNow.toLocaleString()}
        hint="Active in the last 5 minutes"
      />
      <MetricCard
        icon={<GraduationCap className="h-5 w-5" aria-hidden="true" />}
        label="Course completion"
        value={completion}
        hint="Completed vs. active enrollments"
      />
      <MetricCard
        icon={<MailPlus className="h-5 w-5" aria-hidden="true" />}
        label="Pending invites"
        value={stats.pendingInvites.toLocaleString()}
        hint="Awaiting acceptance"
      />
    </section>
  );
}

export default async function AdminMembersPage() {
  try {
    const members = await serverApi.get<MembersListResponse>(
      `/api/v1/members?limit=${String(PAGE_SIZE)}`,
    );

    const [stats, roles] = await Promise.all([
      softGet(serverApi.get<MemberStatsResponse>("/api/v1/members/stats")),
      softGet(serverApi.get<RoleListResponse>("/api/v1/roles?limit=100")),
    ]);

    const availableRoles: RoleOption[] = (roles?.data.items ?? []).map((role) => ({
      id: role.id,
      key: role.key,
      name: role.name,
      isSystem: role.isSystem,
    }));

    return (
      <AdminPageGate screenId="T2" state="ready" title="Members">
        <main className="space-y-8">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <header className="space-y-1">
              <h1 className="text-2xl font-semibold text-[var(--admin-on-surface)]">Members</h1>
              <p className="text-sm text-[var(--admin-on-surface-variant)]">
                Manage tenant memberships, invitations, and member status.
              </p>
            </header>
            <InviteMemberDialog availableRoles={availableRoles} />
          </header>

          {stats ? <MembersMetrics stats={stats.data} /> : null}

          <MembersTable
            initialItems={members.data.items}
            initialTotalCount={members.data.totalCount}
            initialPageInfo={members.data.pageInfo}
            availableRoles={availableRoles}
            pageSize={PAGE_SIZE}
          />
        </main>
      </AdminPageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <AdminPageGate
          screenId="T2"
          state="denied"
          title="Members"
          deniedMessage="You do not have permission to view tenant members."
        />
      );
    }

    throw error;
  }
}
