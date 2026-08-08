import { AdminPageGate } from "../../../../components/patterns/AdminPageGate";
import { AddLanguagePanel } from "../../../../features/admin/languages/AddLanguagePanel";
import type { LanguageRow } from "../../../../features/admin/languages/LanguagesListPanel";
import { ServerApiError, serverApi } from "../../../../lib/server-api";

type MetadataResponse = { data: LanguageRow[] };

export default async function AddLanguagePageRoute() {
  try {
    const metadata = await serverApi.get<MetadataResponse>("/api/v1/locales/metadata");

    return (
      <AdminPageGate screenId="T18" state="ready" title="Add Language">
        <div className="mx-auto max-w-7xl">
          <AddLanguagePanel supported={metadata.data} />
        </div>
      </AdminPageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <AdminPageGate
          screenId="T18"
          state="denied"
          title="Add Language"
          deniedMessage="You do not have permission to manage languages."
        />
      );
    }

    throw error;
  }
}
