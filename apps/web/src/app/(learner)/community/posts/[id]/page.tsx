import Link from "next/link";
import { PageGate } from "../../../../../components/patterns/PageGate";
import { PostThread } from "../../../../../features/community/components/PostThread";
import { ServerApiError, serverApi } from "../../../../../lib/server-api";
import { communityServerApi } from "../../../../../modules/community/community.server-api";
import type { StructuredBody } from "../../../../../server/community/community.dto";

type PostPageProps = {
  params: Promise<{ id: string }>;
};

export default async function CommunityPostPage({ params }: PostPageProps) {
  const { id } = await params;

  try {
    const [comments, me] = await Promise.all([
      communityServerApi.listPostComments(id),
      serverApi.get<{ data: { membership: { id: string } } }>("/api/v1/me"),
    ]);

    const resolved = await resolvePostBody(id);

    return (
      <PageGate state="ready" title="Post thread">
        <main className="space-y-4">
          <Link href="/community" className="text-sm underline">
            Back to community
          </Link>
          <PostThread
            postId={id}
            postBody={resolved.bodyJson}
            authorMembershipId={resolved.authorMembershipId}
            actorMembershipId={me.data.membership.id}
            initialComments={comments.data.items}
          />
        </main>
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError) {
      if (error.status === 401 || error.status === 403 || error.status === 404) {
        return (
          <PageGate
            state="denied"
            title="Post thread"
            deniedMessage="You do not have access to this post."
          />
        );
      }

      return (
        <PageGate
          state="error"
          title="Post thread"
          errorMessage={`Failed to load post thread. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}

async function resolvePostBody(postId: string): Promise<{
  bodyJson: StructuredBody;
  authorMembershipId: string;
}> {
  const spaces = await communityServerApi.listSpaces();

  for (const space of spaces.data.items) {
    try {
      const posts = await communityServerApi.listSpacePosts(space.id);
      const match = posts.data.items.find((post) => post.id === postId);
      if (match) {
        return {
          bodyJson: match.bodyJson,
          authorMembershipId: match.authorMembershipId,
        };
      }
    } catch {
      continue;
    }
  }

  throw new ServerApiError("PERMISSION_DENIED", 404, "missing", "Post not found.");
}
