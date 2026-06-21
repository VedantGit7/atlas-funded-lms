import Link from "next/link";
import { PageGate, PageHeader } from "../../../../components/patterns/PageGate";
import { AdminSpacesEditor } from "../../../../features/community/components/AdminSpacesEditor";
import { ServerApiError } from "../../../../lib/server-api";
import { communityServerApi } from "../../../../modules/community/community.server-api";

export default async function ModerateSpacesPage() {
  try {
    const spaces = await communityServerApi.listSpaces();

    return (
      <PageGate state="ready" title="Community spaces">
        <main className="space-y-6">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <PageHeader
              title="Community spaces"
              description="Create, update, and soft-delete community spaces."
            />
            <Link href="/moderate/cases" className="text-sm underline">
              Back to moderation
            </Link>
          </header>
          <AdminSpacesEditor initialSpaces={spaces.data.items} />
        </main>
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <PageGate
          state="denied"
          title="Community spaces"
          deniedMessage="You do not have permission to manage community spaces."
        />
      );
    }

    throw error;
  }
}
