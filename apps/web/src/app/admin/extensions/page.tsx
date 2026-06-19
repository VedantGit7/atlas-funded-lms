import type { z } from "zod";
import { PageGate, PageHeader } from "../../../components/patterns/PageGate";
import { ExtensionsAdmin } from "../../../features/extensions/components/extensions-admin";
import { ServerApiError, serverApi } from "../../../lib/server-api";
import type {
  extensionPointListResponseSchema,
  extensionRegistrationListResponseSchema,
} from "../../../features/extensions/extensions-response-schemas";

type ExtensionPointListResponse = z.infer<typeof extensionPointListResponseSchema>;
type ExtensionRegistrationListResponse = z.infer<typeof extensionRegistrationListResponseSchema>;

export default async function ExtensionsPage() {
  try {
    const [extensionPoints, registrations] = await Promise.all([
      serverApi.get<ExtensionPointListResponse>("/api/v1/extension-points"),
      serverApi.get<ExtensionRegistrationListResponse>("/api/v1/extensions/registrations"),
    ]);

    return (
      <PageGate state="ready" title="Extensions">
        <main className="space-y-6">
          <PageHeader
            title="Extensions"
            description="Register and configure first-party extension points."
          />
          <ExtensionsAdmin
            extensionPoints={extensionPoints.data}
            registrations={registrations.data}
          />
        </main>
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <PageGate
          state="denied"
          title="Extensions"
          deniedMessage="You do not have permission to manage extensions."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <PageGate
          state="error"
          title="Extensions"
          errorMessage={`Failed to load extensions. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
