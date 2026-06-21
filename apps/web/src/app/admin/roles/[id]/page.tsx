import type { RoleListResponse } from "@atlas/domain-access/schemas/access-admin";
import { AdminPageGate, PageHeader } from "../../../../components/patterns/AdminPageGate";
import { RoleEditor } from "../../../../features/admin/roles/RoleEditor";
import { ServerApiError, serverApi } from "../../../../lib/server-api";

type AdminRoleEditorPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminRoleEditorPage({ params }: AdminRoleEditorPageProps) {
  const { id } = await params;

  try {
    const roles = await serverApi.get<RoleListResponse>("/api/v1/roles?limit=100");
    const role = roles.data.items.find(
      (item: RoleListResponse["data"]["items"][number]) => item.id === id,
    );

    if (!role) {
      return (
        <AdminPageGate
          screenId="T5"
          state="not_found"
          title="Role editor"
          notFoundMessage="Role not found or access denied."
        />
      );
    }

    return (
      <AdminPageGate screenId="T5" state="ready" title="Role editor">
        <main className="space-y-6">
          <PageHeader
            title={role.name}
            description={`${role.key} — ${role.isSystem ? "System role" : "Custom role"}`}
          />
          <RoleEditor role={role} />
        </main>
      </AdminPageGate>
    );
  } catch (error: unknown) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <AdminPageGate
          screenId="T5"
          state="denied"
          title="Role editor"
          deniedMessage="You do not have permission to view tenant roles."
        />
      );
    }

    throw error;
  }
}
