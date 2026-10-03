import { PageGate } from "../../../../../components/patterns/PageGate";
import { CommunityExperience } from "../../../../../features/community/components/CommunityExperience";
import type { FeedPost } from "../../../../../features/community/components/PostCard";
import { ServerApiError, serverApi } from "../../../../../lib/server-api";
import { communityServerApi } from "@/modules/community/community.server-api";

type SpacePageProps = {
  params: Promise<{ id: string }>;
};

export default async function CommunitySpacePage({ params }: SpacePageProps) {
  const { id } = await params;

  try {
    const [spacesResponse, me] = await Promise.all([
      communityServerApi.listSpaces(),
      serverApi.get<{
        data: { membership: { id: string }; profile: { displayName: string | null } | null };
      }>("/api/v1/me"),
    ]);

    const spaces = spacesResponse.data.items;
    const space = spaces.find((item) => item.id === id);

    if (!space) {
      return (
        <PageGate
          state="denied"
          title="Community space"
          deniedMessage="This space is not available."
        />
      );
    }

    let initialPosts: FeedPost[] = [];
    try {
      const posts = await communityServerApi.listSpacePosts(id);
      initialPosts = posts.data.items;
    } catch {
      initialPosts = [];
    }

    return (
      <PageGate state="ready" title={space.name}>
        <main className="mx-auto w-full max-w-6xl">
          <header className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Community
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Discover spaces, join discussions, and connect with other learners.
            </p>
          </header>
          <CommunityExperience
            spaces={spaces}
            viewer={{
              membershipId: me.data.membership.id,
              displayName: me.data.profile?.displayName ?? null,
            }}
            initialActiveSpaceId={id}
            initialPosts={initialPosts}
          />
        </main>
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError) {
      if (error.code === "ENTITLEMENT_REQUIRED") {
        return (
          <PageGate
            state="denied"
            title="Community space"
            deniedMessage="Community is not enabled for this tenant."
          />
        );
      }

      if (error.status === 401 || error.status === 403 || error.status === 404) {
        return (
          <PageGate
            state="denied"
            title="Community space"
            deniedMessage="You do not have access to this space."
          />
        );
      }

      return (
        <PageGate
          state="error"
          title="Community space"
          errorMessage={`Failed to load space feed. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
