import type { z } from "zod";
import { AdminPageGate, PageHeader } from "../../../components/patterns/AdminPageGate";
import { LocalesAdmin } from "../../../features/locales/components/LocalesAdmin";
import { ServerApiError, serverApi } from "../../../lib/server-api";
import type { localeResourceListResponseSchema } from "../../../server/locales/locale.dto";

type LocaleResourceListResponse = z.infer<typeof localeResourceListResponseSchema>;

export default async function AdminLocalesPage() {
  try {
    const locales = await serverApi.get<LocaleResourceListResponse>("/api/v1/locales");

    return (
      <AdminPageGate screenId="T18" state="ready" title="Locales">
        <main className="space-y-6">
          <PageHeader
            title="Locales"
            description="Manage tenant locale string overrides with sanitized plain text values."
          />
          <LocalesAdmin initialResources={locales.data} canManage />
        </main>
      </AdminPageGate>
    );
  } catch (error: unknown) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <AdminPageGate
          screenId="T18"
          state="denied"
          title="Locales"
          deniedMessage="You do not have permission to manage locale resources."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <AdminPageGate
          screenId="T18"
          state="error"
          title="Locales"
          errorMessage={`Failed to load locale resources. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
