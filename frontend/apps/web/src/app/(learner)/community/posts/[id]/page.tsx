import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageGate } from "../../../../../components/patterns/PageGate";
import { PostCard, type FeedPost } from "../../../../../features/community/components/PostCard";
import type { CommentItem } from "../../../../../features/community/components/CommentTree";
import { ServerApiError, serverApi } from "../../../../../lib/server-api";
import { communityServerApi } from "@/modules/community/community.server-api";

type PostPageProps = {
  params: Promise<{ id: string }>;
};

export default async function CommunityPostPage({ params }: PostPageProps) {
  const { id } = await params;

  try {
    const [post, comments, me] = await Promise.all([
      communityServerApi.getPost(id),
      communityServerApi.listPostComments(id),
      serverApi.get<{
        data: { membership: { id: string }; profile: { displayName: string | null } | null };
      }>("/api/v1/me"),
    ]);

    const feedPost: FeedPost = {
      id: post.data.id,
      title: post.data.title,
      bodyJson: post.data.bodyJson,
      authorMembershipId: post.data.authorMembershipId,
      ...(post.data.author ? { author: post.data.author } : {}),
      createdAt: post.data.createdAt,
      commentCount: comments.data.items.length,
      ...(post.data.reactionCounts ? { reactionCounts: post.data.reactionCounts } : {}),
      ...(post.data.viewerReactionKeys ? { viewerReactionKeys: post.data.viewerReactionKeys } : {}),
      appealableModerationCaseId: post.data.appealableModerationCaseId ?? null,
    };

    return (
      <PageGate state="ready" title="Post">
        <main className="mx-auto w-full max-w-3xl space-y-6">
          <Link
            href="/community"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            Back to community
          </Link>
          <PostCard
            post={feedPost}
            viewer={{
              membershipId: me.data.membership.id,
              displayName: me.data.profile?.displayName ?? null,
            }}
            defaultExpanded
            initialComments={comments.data.items as CommentItem[]}
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
            title="Post"
            deniedMessage="You do not have access to this post."
          />
        );
      }

      return (
        <PageGate
          state="error"
          title="Post"
          errorMessage={`Failed to load post. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
