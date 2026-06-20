import type { z } from "zod";
import { PageGate, PageHeader } from "../../../components/patterns/PageGate";
import { LocalesAdmin } from "../../../features/locales/components/LocalesAdmin";
import { ServerApiError, serverApi } from "../../../lib/server-api";
import type { localeResourceListResponseSchema } from "../../../server/locales/locale.dto";

type LocaleResourceListResponse = z.infer<typeof localeResourceListResponseSchema>;

export default async function AdminLocalesPage() {
  try {
    const locales = await serverApi.get<LocaleResourceListResponse>("/api/v1/locales");

    return (
      <PageGate state="ready" title="Locales">
        <main className="space-y-6">
          <PageHeader
            title="Locales"
            description="Manage tenant locale string overrides with sanitized plain text values."
          />
          <LocalesAdmin initialResources={locales.data} canManage />
        </main>
      </PageGate>
    );
  } catch (error: unknown) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <PageGate
          state="denied"
          title="Locales"
          deniedMessage="You do not have permission to manage locale resources."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <PageGate
          state="error"
          title="Locales"
          errorMessage={`Failed to load locale resources. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
