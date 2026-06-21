import type { z } from "zod";
import type { membersListResponseSchema } from "@atlas/membership";
import { AdminPageGate, PageHeader } from "../../../components/patterns/AdminPageGate";
import { InviteMemberDialog } from "../../../features/admin/members/InviteMemberDialog";
import { MembersTable } from "../../../features/admin/members/MembersTable";
import { ServerApiError, serverApi } from "../../../lib/server-api";

type MembersListResponse = z.infer<typeof membersListResponseSchema>;

export default async function AdminMembersPage() {
  try {
    const members = await serverApi.get<MembersListResponse>("/api/v1/members?limit=100");

    return (
      <AdminPageGate screenId="T2" state="ready" title="Members">
        <main className="space-y-6">
          <header className="flex items-start justify-between gap-4">
            <PageHeader
              title="Members"
              description="Manage tenant memberships, invitations, and member status."
            />
            <InviteMemberDialog />
          </header>

          <MembersTable members={members.data.items} />
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
