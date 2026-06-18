import type { MemberDetailResponse } from "@atlas/membership";
import type {
  PermissionOverrideListResponse,
  RoleListResponse,
} from "@atlas/domain-access/schemas/access-admin";
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
    const label =
      member.data.profile?.displayName ??
      member.data.invitedEmail ??
      `Member ${member.data.id.slice(0, 8)}`;

    return (
      <main className="space-y-6">
        <header>
          <h1>{label}</h1>
          <p>Status: {member.data.status}</p>
          {isOwnerMember ? (
            <p>The owner membership has protected status and role actions.</p>
          ) : null}
        </header>

        <section>
          <h2>Profile</h2>
          <MemberProfileEditor membershipId={id} profile={member.data.profile} />
        </section>

        <MemberRoleEditor
          membershipId={id}
          assignedRoles={member.data.roles}
          availableRoles={roles.data.items}
          isOwnerMember={isOwnerMember}
        />

        <PermissionOverridePanel membershipId={id} overrides={overrides.data.items} />
      </main>
    );
  } catch (error: unknown) {
    if (error instanceof ServerApiError && (error.status === 403 || error.status === 404)) {
      return (
        <main>
          <h1>Member detail</h1>
          <p role="alert">Member not found or access denied.</p>
        </main>
      );
    }

    throw error;
  }
}
