export const dynamic = "force-dynamic";

import type { MemberDetailResponse } from "@atlas/contracts/membership/schemas/admin-members";
import type {
  PermissionOverrideListResponse,
  RoleListResponse,
} from "@atlas/domain-access/schemas/access-admin";
import { AdminPageGate } from "../../../../components/patterns/AdminPageGate";
import { MemberIdentityHeader } from "../../../../features/admin/members/MemberIdentityHeader";
import { MemberOwnerBanner } from "../../../../features/admin/members/MemberOwnerBanner";
import { MemberProfileEditor } from "../../../../features/admin/members/MemberProfileEditor";
import { MemberRoleEditor } from "../../../../features/admin/members/MemberRoleEditor";
import { PermissionOverridePanel } from "../../../../features/admin/members/PermissionOverridePanel";
import { ServerApiError, serverApi } from "../../../../lib/server-api";

type AdminMemberDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminMemberDetailPage({ params }: AdminMemberDetailPageProps) {
  const { id } = await params;

  try {
    const [member, roles, overrides] = await Promise.all([
      serverApi.get<MemberDetailResponse>(`/api/v1/members/${id}`),
      serverApi.get<RoleListResponse>("/api/v1/roles?limit=100"),
      serverApi.get<PermissionOverrideListResponse>(
        `/api/v1/permission-overrides?membershipId=${id}&limit=100`,
      ),
    ]);

    const isOwnerMember = member.data.roles.some((role: { key: string }) => role.key === "owner");
    const displayName =
      member.data.profile?.displayName ??
      member.data.invitedEmail ??
      `Member ${member.data.id.slice(0, 8)}`;

    return (
      <AdminPageGate screenId="T3" state="ready" title="Member detail">
        <div className="mx-auto flex w-full max-w-[800px] flex-col gap-6">
          <MemberIdentityHeader
            displayName={displayName}
            email={member.data.invitedEmail}
            status={member.data.status}
            joinedAt={member.data.joinedAt}
            avatarUrl={member.data.profile?.avatarUrl ?? null}
          />

          {isOwnerMember ? <MemberOwnerBanner /> : null}

          <MemberProfileEditor membershipId={id} profile={member.data.profile} />

          <MemberRoleEditor
            membershipId={id}
            assignedRoles={member.data.roles}
            availableRoles={roles.data.items}
            isOwnerMember={isOwnerMember}
          />

          <PermissionOverridePanel membershipId={id} overrides={overrides.data.items} />
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
