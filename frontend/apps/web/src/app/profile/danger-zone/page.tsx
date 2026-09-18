import Link from "next/link";
import { Info } from "lucide-react";
import { PageGate } from "../../../components/patterns/PageGate";
import { AccountSettingsPageHeader } from "../../../features/account-settings/account-settings-page-header";
import { AccountDeletionCard } from "../../../features/data-rights/components/account-deletion-card";
import { ArchiveAccountCard } from "../../../features/data-rights/components/archive-account-card";
import { ServerApiError, serverApi } from "../../../lib/server-api";

export default async function ProfileDangerZonePage() {
  try {
    const me = await serverApi.get<{
      data: {
        identity: { email: string | null };
        membership: { id: string };
      };
    }>("/api/v1/me");

    const [deletionStatus, archiveStatus, profile] = await Promise.all([
      serverApi
        .get<{ data: { pending: boolean } }>("/api/v1/me/deletion-request")
        .catch(() => ({ data: { pending: false } })),
      serverApi
        .get<{ data: { archivedAt: string | null } }>("/api/v1/me/archive")
        .catch(() => ({ data: { archivedAt: null } })),
      serverApi
        .get<{
          data: { profileVisibility: "PUBLIC" | "PRIVATE" };
        }>(`/api/v1/members/${me.data.membership.id}/profile`)
        .catch(() => ({ data: { profileVisibility: "PUBLIC" as const } })),
    ]);

    return (
      <PageGate state="ready" title="Danger zone">
        <AccountSettingsPageHeader
          title="Danger zone"
          description="Irreversible actions that affect your entire account visibility and data presence."
        />

        <section className="overflow-hidden rounded-xl border border-[var(--acct-danger-border)] bg-[var(--acct-surface-lowest)] shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--acct-border)] p-6">
            <div>
              <h3 className="text-lg font-semibold text-[var(--acct-on-surface)]">
                Change account visibility
              </h3>
              <p className="text-sm text-[var(--acct-on-surface-variant)]">
                {profile.data.profileVisibility === "PUBLIC"
                  ? "Your profile is visible in community surfaces."
                  : "Your profile is private in community surfaces."}
              </p>
            </div>
            <Link
              href="/profile/privacy"
              className="rounded-lg border border-[var(--acct-outline)] px-4 py-2 text-xs font-semibold text-[var(--acct-on-surface)] transition-colors hover:bg-[var(--acct-surface-low)]"
            >
              Change visibility
            </Link>
          </div>
          <ArchiveAccountCard initialArchivedAt={archiveStatus.data.archivedAt} />
          <AccountDeletionCard
            canRequestDeletion
            initialPending={deletionStatus.data.pending}
            email={me.data.identity.email}
          />
        </section>

        <div className="mt-8 flex gap-4 rounded-lg border border-[var(--acct-border)] bg-[var(--acct-surface-low)] p-4">
          <Info className="h-5 w-5 shrink-0 text-[var(--acct-primary)]" aria-hidden="true" />
          <div>
            <h4 className="text-xs font-medium text-[var(--acct-on-surface)]">
              What happens to your data?
            </h4>
            <p className="mt-1 text-sm leading-relaxed text-[var(--acct-on-surface-variant)]">
              Deleting your account results in permanent removal of personal profile data and
              history. Public contributions may be anonymized. You cannot undo this action once an
              administrator approves deletion.
            </p>
          </div>
        </div>
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <PageGate
          state="denied"
          title="Danger zone"
          deniedMessage="You do not have permission to view this page."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <PageGate
          state="error"
          title="Danger zone"
          errorMessage={`Failed to load. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
