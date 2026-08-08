export const dynamic = "force-dynamic";

import type { RoleDetailResponse } from "@atlas/domain-access/schemas/access-admin";
import { AdminPageGate } from "../../../../components/patterns/AdminPageGate";
import { RoleEditor } from "../../../../features/admin/roles/RoleEditor";
import { ServerApiError, serverApi } from "../../../../lib/server-api";

type AdminRoleEditorPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminRoleEditorPage({ params }: AdminRoleEditorPageProps) {
  const { id } = await params;

  try {
    const response = await serverApi.get<RoleDetailResponse>(`/api/v1/roles/${id}`);

    return (
      <AdminPageGate screenId="T5" state="ready" title="Role editor">
        <RoleEditor role={response.data} />
      </AdminPageGate>
    );
  } catch (error: unknown) {
    if (error instanceof ServerApiError && error.status === 404) {
      return (
        <AdminPageGate
          screenId="T5"
          state="not_found"
          title="Role editor"
          notFoundMessage="Role not found or access denied."
        />
      );
    }

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
