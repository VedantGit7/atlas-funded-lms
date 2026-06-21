import Link from "next/link";
import type { MembersListResponse } from "@atlas/membership";
import { AdminPageGate, PageHeader } from "../../../components/patterns/AdminPageGate";
import { AdminGamificationEditor } from "../../../features/gamification/components/AdminGamificationEditor";
import { ServerApiError, serverApi } from "../../../lib/server-api";

export default async function AdminGamificationPage() {
  try {
    const members = await serverApi.get<MembersListResponse>(
      "/api/v1/members?limit=25&status=ACTIVE",
    );

    const memberOptions = members.data.items.map((member) => ({
      id: member.id,
      label: member.profile?.displayName ?? member.id,
    }));

    return (
      <AdminPageGate screenId="T14" state="ready" title="Gamification Config">
        <main className="space-y-6">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <PageHeader
              title="Gamification"
              description="Configure badges, leaderboards, and manual badge awards."
            />
            <Link href="/admin" className="text-sm underline">
              Back to admin
            </Link>
          </header>

          <AdminGamificationEditor members={memberOptions} />
        </main>
      </AdminPageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <AdminPageGate
          screenId="T14"
          state="denied"
          title="Gamification Config"
          deniedMessage="You do not have permission to manage gamification."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <AdminPageGate
          screenId="T14"
          state="error"
          title="Gamification Config"
          errorMessage={`Failed to load gamification config. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
