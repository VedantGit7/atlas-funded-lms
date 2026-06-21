import { AdminPageGate, PageHeader } from "../../../components/patterns/AdminPageGate";
import { TenantConfigEditor } from "../../../features/admin/config/TenantConfigEditor";
import { ServerApiError, serverApi } from "../../../lib/server-api";
import type { TenantConfigResponse } from "@atlas/domain-config/schemas/tenant-config";

export default async function AdminConfigPage() {
  try {
    const config = await serverApi.get<TenantConfigResponse>("/api/v1/config");

    return (
      <AdminPageGate screenId="T8" state="ready" title="Configuration">
        <main className="space-y-6">
          <PageHeader
            title="Configuration"
            description="Edit tenant runtime configuration sections and publish approved versions."
          />
          <TenantConfigEditor initialConfigJson={config.data.configJson} canPublish />
        </main>
      </AdminPageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <AdminPageGate
          screenId="T8"
          state="denied"
          title="Configuration"
          deniedMessage="You do not have permission to view tenant configuration."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <AdminPageGate
          screenId="T8"
          state="error"
          title="Configuration"
          errorMessage={`Failed to load configuration. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
