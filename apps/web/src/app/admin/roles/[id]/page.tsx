import type { RoleListResponse } from "@atlas/domain-access/schemas/access-admin";
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
        <main>
          <h1>Role editor</h1>
          <p role="alert">Role not found or access denied.</p>
        </main>
      );
    }

    return (
      <main className="space-y-6">
        <header>
          <h1>{role.name}</h1>
          <p>
            {role.key} — {role.isSystem ? "System role" : "Custom role"}
          </p>
        </header>

        <RoleEditor role={role} />
      </main>
    );
  } catch (error: unknown) {
    if (error instanceof ServerApiError && error.status === 403) {
      return (
        <main>
          <h1>Role editor</h1>
          <p role="alert">You do not have permission to view tenant roles.</p>
        </main>
      );
    }

    throw error;
  }
}
