import type { z } from "zod";
import type { roleListResponseSchema } from "@atlas/domain-access/schemas/access-admin";
import { AdminPageGate } from "../../../components/patterns/AdminPageGate";
import { CreateRoleDialog } from "../../../features/admin/roles/CreateRoleDialog";
import { RolesTable } from "../../../features/admin/roles/RolesTable";
import { ServerApiError, serverApi } from "../../../lib/server-api";

type RoleListResponse = z.infer<typeof roleListResponseSchema>;

export default async function AdminRolesPage() {
  try {
    const roles = await serverApi.get<RoleListResponse>("/api/v1/roles?limit=100");

    return (
      <AdminPageGate screenId="T4" state="ready" title="Roles & Permissions">
        <main className="space-y-8">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1">
              <h1 className="text-[32px] font-extrabold leading-tight tracking-[-0.02em] text-[var(--admin-on-surface)] sm:text-[40px]">
                Roles &amp; Permissions
              </h1>
              <p className="text-base text-[var(--admin-on-surface-variant)]">
                View tenant roles and manage custom role definitions.
              </p>
            </div>
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
