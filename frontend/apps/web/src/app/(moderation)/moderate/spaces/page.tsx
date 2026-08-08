import Link from "next/link";
import { PageGate, PageHeader } from "../../../../components/patterns/PageGate";
import { AdminSpacesEditor } from "../../../../features/community/components/AdminSpacesEditor";
import { ADMIN_MODERATION_CASES_PATH } from "../../../../features/moderation/moderation-paths";
import { ServerApiError, serverApi } from "../../../../lib/server-api";
import { resolveModerationSpaceVisibilityOptions } from "../../../../lib/server/moderation-navigation-projection";
import { communityServerApi } from "@atlas/contracts-modules/community/community.server-api";
import type { EntitlementView } from "@atlas/domain-config/schemas/entitlements";

export default async function ModerateSpacesPage() {
  try {
    const [spaces, entitlements] = await Promise.all([
      communityServerApi.listSpaces(),
      serverApi.get<{ data: EntitlementView[] }>("/api/v1/entitlements"),
    ]);

    const enabledEntitlements = new Set(
      entitlements.data.filter((entry) => entry.enabled).map((entry) => entry.key),
    );

    if (!enabledEntitlements.has("community.enable")) {
      return (
        <PageGate
          state="denied"
          title="Community spaces"
          deniedMessage="Community moderation requires the community entitlement."
        />
      );
    }

    return (
      <PageGate state="ready" title="Community spaces">
        <main className="space-y-6">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <PageHeader
              title="Community spaces"
              description="Create, update, and soft-delete community spaces."
            />
            <Link href={ADMIN_MODERATION_CASES_PATH} className="text-sm underline">
              Back to moderation
            </Link>
          </header>
          <AdminSpacesEditor
            initialSpaces={spaces.data.items}
            allowedVisibilityOptions={resolveModerationSpaceVisibilityOptions(enabledEntitlements)}
          />
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

    if (error instanceof ServerApiError && error.code === "ENTITLEMENT_REQUIRED") {
      return (
        <PageGate
          state="denied"
          title="Community spaces"
          deniedMessage="Community moderation requires the community entitlement."
        />
      );
    }

    throw error;
  }
}
