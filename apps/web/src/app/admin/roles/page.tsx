import type { z } from "zod";
import type { roleListResponseSchema } from "@atlas/domain-access/schemas/access-admin";
import { CreateRoleDialog } from "../../../features/admin/roles/CreateRoleDialog";
import { RolesTable } from "../../../features/admin/roles/RolesTable";
import { ServerApiError, serverApi } from "../../../lib/server-api";

type RoleListResponse = z.infer<typeof roleListResponseSchema>;

export default async function AdminRolesPage() {
  try {
    const roles = await serverApi.get<RoleListResponse>("/api/v1/roles?limit=100");

    return (
      <main className="space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1>Roles & Permissions</h1>
            <p>View tenant roles and manage custom role definitions.</p>
          </div>
          <CreateRoleDialog />
        </header>

        <RolesTable roles={roles.data.items} />
      </main>
    );
  } catch (error) {
    if (error instanceof ServerApiError && error.status === 403) {
      return (
        <main>
          <h1>Roles & Permissions</h1>
          <p role="alert">You do not have permission to view tenant roles.</p>
        </main>
      );
    }

    throw error;
  }
}
