import { serverApi } from "../../lib/server-api";
import type { z } from "zod";
import type {
  commentListResponseSchema,
  postListResponseSchema,
  spaceListResponseSchema,
} from "../../server/community/community.dto";

type SpaceListResponse = z.infer<typeof spaceListResponseSchema>;
type PostListResponse = z.infer<typeof postListResponseSchema>;
type CommentListResponse = z.infer<typeof commentListResponseSchema>;

export const communityServerApi = {
  async listSpaces(): Promise<SpaceListResponse> {
    return serverApi.get<SpaceListResponse>("/api/v1/spaces");
  },

  async listSpacePosts(spaceId: string): Promise<PostListResponse> {
    return serverApi.get<PostListResponse>(`/api/v1/spaces/${spaceId}/posts`);
  },

  async listPostComments(postId: string): Promise<CommentListResponse> {
    return serverApi.get<CommentListResponse>(`/api/v1/posts/${postId}/comments`);
  },
};
