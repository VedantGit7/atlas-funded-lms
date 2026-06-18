import type { z } from "zod";
import type { membersListResponseSchema } from "@atlas/membership";
import { InviteMemberDialog } from "../../../features/admin/members/InviteMemberDialog";
import { MembersTable } from "../../../features/admin/members/MembersTable";
import { ServerApiError, serverApi } from "../../../lib/server-api";

type MembersListResponse = z.infer<typeof membersListResponseSchema>;

export default async function AdminMembersPage() {
  try {
    const members = await serverApi.get<MembersListResponse>("/api/v1/members?limit=100");

    return (
      <main className="space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1>Members</h1>
            <p>Manage tenant memberships, invitations, and member status.</p>
          </div>
          <InviteMemberDialog />
        </header>

        <MembersTable members={members.data.items} />
      </main>
    );
  } catch (error) {
    if (error instanceof ServerApiError && error.status === 403) {
      return (
        <main>
          <h1>Members</h1>
          <p role="alert">You do not have permission to view tenant members.</p>
        </main>
      );
    }

    throw error;
  }
}
