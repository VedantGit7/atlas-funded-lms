import { PageGate } from "../../../components/patterns/PageGate";
import { CommunityExperience } from "../../../features/community/components/CommunityExperience";
import type { FeedPost } from "../../../features/community/components/PostCard";
import { ServerApiError, serverApi } from "../../../lib/server-api";
import { communityServerApi } from "@/modules/community/community.server-api";

type CommunityPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readSearchParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const value = params[key];
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function CommunityPage({ searchParams }: CommunityPageProps) {
  const query = await searchParams;
  const requestedSpaceId = readSearchParam(query, "space");

  try {
    const [spacesResponse, me] = await Promise.all([
      communityServerApi.listSpaces(),
      serverApi.get<{
        data: { membership: { id: string }; profile: { displayName: string | null } | null };
      }>("/api/v1/me"),
    ]);

    const spaces = spacesResponse.data.items;
    const activeSpaceId =
      (requestedSpaceId && spaces.some((space) => space.id === requestedSpaceId)
        ? requestedSpaceId
        : null) ??
      spaces.find((space) => space.isMember)?.id ??
      spaces[0]?.id ??
      null;

    let initialPosts: FeedPost[] = [];
    if (activeSpaceId) {
      try {
        const posts = await communityServerApi.listSpacePosts(activeSpaceId);
        initialPosts = posts.data.items;
      } catch {
        // Non-fatal: still render the space header + join affordance if the feed
        // can't be loaded (e.g. viewer hasn't joined a restricted space yet).
        initialPosts = [];
      }
    }

    return (
      <PageGate state="ready" title="Community">
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
            initialActiveSpaceId={activeSpaceId}
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
            title="Community"
            deniedMessage="Community is not enabled for this tenant."
          />
        );
      }

      if (error.status === 401 || error.status === 403) {
        return (
          <PageGate
            state="denied"
            title="Community"
            deniedMessage="You do not have permission to view community spaces."
          />
        );
      }

      return (
        <PageGate
          state="error"
          title="Community"
          errorMessage={`Failed to load community. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
