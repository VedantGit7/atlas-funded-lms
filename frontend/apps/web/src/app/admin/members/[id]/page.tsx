export const dynamic = "force-dynamic";

import type { z } from "zod";
import type { MemberDetailResponse } from "@atlas/contracts/membership/schemas/admin-members";
import type { memberOverviewResponseSchema } from "@atlas/contracts/members/member-overview.schemas";
import type {
  PermissionOverrideListResponse,
  RoleListResponse,
} from "@atlas/domain-access/schemas/access-admin";
import { AdminPageGate } from "../../../../components/patterns/AdminPageGate";
import { MemberActions } from "../../../../features/admin/members/MemberActions";
import { MemberIdentityHeader } from "../../../../features/admin/members/MemberIdentityHeader";
import { MemberLearnerOverview } from "../../../../features/admin/members/MemberLearnerOverview";
import { MemberOwnerBanner } from "../../../../features/admin/members/MemberOwnerBanner";
import { MemberProfileEditor } from "../../../../features/admin/members/MemberProfileEditor";
import { MemberRoleEditor } from "../../../../features/admin/members/MemberRoleEditor";
import { PermissionOverridePanel } from "../../../../features/admin/members/PermissionOverridePanel";
import { ServerApiError, serverApi } from "../../../../lib/server-api";

type MemberOverviewResponse = z.infer<typeof memberOverviewResponseSchema>;

type AdminMemberDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminMemberDetailPage({ params }: AdminMemberDetailPageProps) {
  const { id } = await params;

  try {
    const [member, roles, overrides, overview] = await Promise.all([
      serverApi.get<MemberDetailResponse>(`/api/v1/members/${id}`),
      serverApi.get<RoleListResponse>("/api/v1/roles?limit=100"),
      serverApi.get<PermissionOverrideListResponse>(
        `/api/v1/permission-overrides?membershipId=${id}&limit=100`,
      ),
      // The learner profile; the rest of the page still works without it.
      serverApi.get<MemberOverviewResponse>(`/api/v1/members/${id}/overview`).catch(() => null),
    ]);

    const isOwnerMember = member.data.roles.some((role: { key: string }) => role.key === "owner");
    const email = overview?.data.email ?? member.data.invitedEmail;
    const displayName =
      member.data.profile?.displayName ?? email ?? `Member ${member.data.id.slice(0, 8)}`;

    return (
      <AdminPageGate screenId="T3" state="ready" title="Member detail">
        <div className="mx-auto flex w-full max-w-[960px] flex-col gap-6">
          <MemberIdentityHeader
            displayName={displayName}
            email={email}
            status={member.data.status}
            joinedAt={member.data.joinedAt}
            avatarUrl={member.data.profile?.avatarUrl ?? null}
            lastActiveAt={overview?.data.lastActiveAt ?? null}
          />

          <MemberActions
            membershipId={id}
            displayName={displayName}
            email={email}
            status={member.data.status}
            isOwner={isOwnerMember}
            enrolledCourseIds={
              overview?.data.courses
                .filter((course) => course.status === "active")
                .map((course) => course.courseId) ?? []
            }
          />

          {isOwnerMember ? <MemberOwnerBanner /> : null}

          {overview ? (
            <MemberLearnerOverview overview={overview.data} />
          ) : (
            <p role="status" className="text-sm text-[var(--admin-on-surface-variant)]">
              Couldn&rsquo;t load this member&rsquo;s courses and activity. Refresh to try again.
            </p>
          )}

          <MemberProfileEditor membershipId={id} profile={member.data.profile} />

          <MemberRoleEditor
            membershipId={id}
            assignedRoles={member.data.roles}
            availableRoles={roles.data.items}
            isOwnerMember={isOwnerMember}
          />

          {/* Individual permission overrides are rarely needed (QA review 2 H22
              showed 173 raw keys up front), so they sit under Advanced. */}
          <details className="group rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
            <summary className="cursor-pointer list-none px-6 py-4 text-sm font-semibold text-[var(--admin-on-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]">
              Advanced: permission overrides
              <span className="ml-2 font-normal text-[var(--admin-on-surface-variant)]">
                {overrides.data.items.length === 0
                  ? "None set"
                  : `${String(overrides.data.items.length)} set`}
              </span>
            </summary>
            <div className="border-t border-[var(--admin-border)] p-4">
              <PermissionOverridePanel membershipId={id} overrides={overrides.data.items} />
            </div>
          </details>
        </div>
      </AdminPageGate>
    );
  } catch (error: unknown) {
    if (error instanceof ServerApiError && (error.status === 403 || error.status === 404)) {
      return (
        <AdminPageGate
          screenId="T3"
          state="not_found"
          title="Member detail"
          notFoundMessage="Member not found or access denied."
        />
      );
    }

    throw error;
  }
}
