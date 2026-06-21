import { PageGate, PageHeader } from "../../components/patterns/PageGate";
import { ProfileForm } from "../../features/learner/components/ProfileForm";
import { ServerApiError, serverApi } from "../../lib/server-api";
import type { z } from "zod";
import type { memberProfileResponseSchema } from "@atlas/membership/schemas/admin-members";

type MemberProfileResponse = z.infer<typeof memberProfileResponseSchema>;

export default async function ProfilePage() {
  try {
    const me = await serverApi.get<{
      data: {
        membership: { id: string };
      };
    }>("/api/v1/me");

    const profile = await serverApi.get<MemberProfileResponse>(
      `/api/v1/members/${me.data.membership.id}/profile`,
    );

    return (
      <PageGate state="ready" title="Profile">
        <main className="space-y-6">
          <PageHeader
            title="Profile"
            description="Update your display name and bio for this academy."
          />
          <ProfileForm
            membershipId={me.data.membership.id}
            initialDisplayName={profile.data.displayName}
            initialBio={profile.data.bio ?? null}
          />
        </main>
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <PageGate
          state="denied"
          title="Profile"
          deniedMessage="You do not have permission to view your profile."
        />
      );
    }

    if (error instanceof ServerApiError && error.status === 404) {
      return (
        <PageGate
          state="not_found"
          title="Profile"
          notFoundMessage="Profile not found or access denied."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <PageGate
          state="error"
          title="Profile"
          errorMessage={`Failed to load profile. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
