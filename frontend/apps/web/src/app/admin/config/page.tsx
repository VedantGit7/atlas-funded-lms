import { AdminPageGate } from "../../../components/patterns/AdminPageGate";
import { TenantConfigEditor } from "../../../features/admin/config/TenantConfigEditor";
import { TenantConfigVersionHistory } from "../../../features/admin/config/TenantConfigVersionHistory";
import { ServerApiError, serverApi } from "../../../lib/server-api";
import type {
  TenantConfigResponse,
  TenantConfigVersionsResponse,
} from "@atlas/domain-config/schemas/tenant-config";

export default async function AdminConfigPage() {
  try {
    const [config, versions] = await Promise.all([
      serverApi.get<TenantConfigResponse>("/api/v1/config"),
      serverApi.get<TenantConfigVersionsResponse>("/api/v1/config/versions"),
    ]);

    return (
      <AdminPageGate screenId="T8" state="ready" title="Configuration">
        <div className="mx-auto max-w-7xl space-y-8">
          <TenantConfigEditor
            initialConfigJson={config.data.configJson}
            version={config.data.version}
            updatedAt={config.data.updatedAt}
            canPublish
          />
          <TenantConfigVersionHistory versions={versions.data} />
        </div>
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
