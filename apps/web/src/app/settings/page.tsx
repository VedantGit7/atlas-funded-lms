import { PageGate, PageHeader } from "../../components/patterns/PageGate";
import { AccountDeletionCard } from "../../features/data-rights/components/account-deletion-card";
import { ServerApiError, serverApi } from "../../lib/server-api";

export default async function SettingsPage() {
  try {
    const me = await serverApi.get<{
      data: {
        membership: { id: string; status: string };
        profile: { displayName: string | null } | null;
      };
    }>("/api/v1/me");

    return (
      <PageGate state="ready" title="Settings">
        <main className="space-y-6">
          <PageHeader
            title="Settings"
            description="Manage your account preferences and data-rights requests."
          />
          <section className="rounded border p-4">
            <h2 className="text-lg font-semibold">Account</h2>
            <p className="text-sm">
              Signed in as {me.data.profile?.displayName ?? "Member"} ({me.data.membership.id})
            </p>
          </section>
          <AccountDeletionCard canRequestDeletion initialPending={false} />
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
