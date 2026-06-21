import { PageGate, PageHeader } from "../../components/patterns/PageGate";
import { AccountDeletionCard } from "../../features/data-rights/components/account-deletion-card";
import { LocalePicker } from "../../features/learner/components/LocalePicker";
import { LogoutConfirmButton } from "../../features/learner/components/LogoutConfirmButton";
import { ServerApiError, serverApi } from "../../lib/server-api";
import type { z } from "zod";
import type { localeResourceListResponseSchema } from "../../server/locales/locale.contract";

type LocaleResourceListResponse = z.infer<typeof localeResourceListResponseSchema>;

export default async function SettingsPage() {
  try {
    const [me, locales] = await Promise.all([
      serverApi.get<{
        data: {
          membership: { id: string; status: string };
          profile: { displayName: string | null } | null;
        };
      }>("/api/v1/me"),
      serverApi.get<LocaleResourceListResponse>("/api/v1/locales").catch(() => ({ data: [] })),
    ]);

    return (
      <PageGate state="ready" title="Settings">
        <main className="space-y-6">
          <PageHeader
            title="Settings"
            description="Manage your account preferences and data-rights requests."
          />
          <section className="rounded border p-4">
            <h2 className="text-lg font-semibold">Account</h2>
            <p className="text-sm">Signed in as {me.data.profile?.displayName ?? "Member"}</p>
          </section>
          <LocalePicker resources={locales.data} />
          <AccountDeletionCard canRequestDeletion initialPending={false} />
          <LogoutConfirmButton />
        </main>
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <PageGate
          state="denied"
          title="Settings"
          deniedMessage="You do not have permission to view settings."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <PageGate
          state="error"
          title="Settings"
          errorMessage={`Failed to load settings. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
