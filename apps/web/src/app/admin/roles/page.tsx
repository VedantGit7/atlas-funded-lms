import type { z } from "zod";
import type { roleListResponseSchema } from "@atlas/domain-access/schemas/access-admin";
import { AdminPageGate, PageHeader } from "../../../components/patterns/AdminPageGate";
import { CreateRoleDialog } from "../../../features/admin/roles/CreateRoleDialog";
import { RolesTable } from "../../../features/admin/roles/RolesTable";
import { ServerApiError, serverApi } from "../../../lib/server-api";

type RoleListResponse = z.infer<typeof roleListResponseSchema>;

export default async function AdminRolesPage() {
  try {
    const roles = await serverApi.get<RoleListResponse>("/api/v1/roles?limit=100");

    return (
      <AdminPageGate screenId="T4" state="ready" title="Roles & Permissions">
        <main className="space-y-6">
          <header className="flex items-start justify-between gap-4">
            <PageHeader
              title="Roles & Permissions"
              description="View tenant roles and manage custom role definitions."
            />
            <CreateRoleDialog />
          </header>

          <RolesTable roles={roles.data.items} />
        </main>
      </AdminPageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <AdminPageGate
          screenId="T4"
          state="denied"
          title="Roles & Permissions"
          deniedMessage="You do not have permission to view tenant roles."
        />
      );
    }

    throw error;
  }
}
