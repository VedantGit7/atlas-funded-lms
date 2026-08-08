import { AdminPageGate } from "../../../components/patterns/AdminPageGate";
import { ExtensionsAdmin } from "../../../features/extensions/components/extensions-admin";
import { ServerApiError, serverApi } from "../../../lib/server-api";
import type {
  extensionPointListResponseSchema,
  extensionRegistrationListResponseSchema,
} from "../../../features/extensions/extensions-response-schemas";
import type { z } from "zod";

type ExtensionPointListResponse = z.infer<typeof extensionPointListResponseSchema>;
type ExtensionRegistrationListResponse = z.infer<typeof extensionRegistrationListResponseSchema>;

export default async function ExtensionsPage() {
  try {
    const [extensionPoints, registrations] = await Promise.all([
      serverApi.get<ExtensionPointListResponse>("/api/v1/extension-points"),
      serverApi.get<ExtensionRegistrationListResponse>("/api/v1/extensions/registrations"),
    ]);

    return (
      <AdminPageGate screenId="T19" state="ready" title="Extensions">
        <main>
          <ExtensionsAdmin
            extensionPoints={extensionPoints.data}
            registrations={registrations.data}
          />
        </main>
      </AdminPageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <AdminPageGate
          screenId="T19"
          state="denied"
          title="Extensions"
          deniedMessage="You do not have permission to manage extensions."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <AdminPageGate
          screenId="T19"
          state="error"
          title="Extensions"
          errorMessage={`Failed to load extensions. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
