import Link from "next/link";
import { PageGate } from "../../../../../components/patterns/PageGate";
import { SpaceFeed } from "../../../../../features/community/components/SpaceFeed";
import { ServerApiError } from "../../../../../lib/server-api";
import { communityServerApi } from "../../../../../modules/community/community.server-api";

type SpacePageProps = {
  params: Promise<{ id: string }>;
};

export default async function CommunitySpacePage({ params }: SpacePageProps) {
  const { id } = await params;

  try {
    const [spaces, posts] = await Promise.all([
      communityServerApi.listSpaces(),
      communityServerApi.listSpacePosts(id),
    ]);

    const space = spaces.data.items.find((item) => item.id === id);

    if (!space) {
      return (
        <PageGate
          state="denied"
          title="Community space"
          deniedMessage="This space is not available."
        />
      );
    }

    return (
      <PageGate state="ready" title={space.name}>
        <main className="space-y-4">
          <Link href="/community" className="text-sm underline">
            Back to community
          </Link>
          <SpaceFeed spaceId={id} spaceName={space.name} initialPosts={posts.data.items} />
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
