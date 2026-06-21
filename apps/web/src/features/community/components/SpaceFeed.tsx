"use client";

import Link from "next/link";
import { useState } from "react";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import { collectVerifyLinks, renderStructuredBody } from "./structured-body";
import type { z } from "zod";
import type { structuredBodySchema } from "../../../server/community/community.dto";

type StructuredBody = z.infer<typeof structuredBodySchema>;

type SpaceFeedProps = {
  spaceId: string;
  spaceName: string;
  initialPosts: Array<{
    id: string;
    title: string | null;
    bodyJson: StructuredBody;
    authorMembershipId: string;
    commentCount?: number | undefined;
    reactionCounts?: Record<string, number> | undefined;
  }>;
};

export function SpaceFeed({ spaceId, spaceName, initialPosts }: SpaceFeedProps) {
  const [posts, setPosts] = useState(initialPosts);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function createPost() {
    const text = draft.trim();
    if (!text) return;

    setSubmitting(true);
    setError(null);

    const bodyJson: StructuredBody = {
      version: 1,
      blocks: [{ type: "paragraph", children: [{ type: "text", text }] }],
    };

    try {
      const response = await clientApi.post<{
        data: SpaceFeedProps["initialPosts"][number];
      }>(`/api/v1/spaces/${spaceId}/posts`, { bodyJson }, "community-post");

      setPosts((current) => [response.data, ...current]);
      setDraft("");
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Unable to create post.");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleReaction(postId: string) {
    try {
      await clientApi.post(
        "/api/v1/reactions",
        { targetType: "post", targetId: postId, reactionKey: "like" },
        "community-reaction",
      );
    } catch {
      // duplicate reactions are safe/idempotent
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">{spaceName}</h1>
      </header>

      <section className="space-y-3 rounded-lg border p-4">
        <label htmlFor="post-draft" className="block text-sm font-medium">
          New post
        </label>
        <textarea
          id="post-draft"
          className="min-h-24 w-full rounded border p-3 text-sm"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
        />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="button"
          className="rounded border px-4 py-2 text-sm"
          disabled={submitting}
          onClick={() => void createPost()}
        >
          {submitting ? "Posting…" : "Post"}
        </button>
      </section>

      <ul className="space-y-4">
        {posts.map((post) => {
          const verifyLinks = collectVerifyLinks(post.bodyJson);
          return (
            <li key={post.id} className="rounded-lg border p-4">
              {post.title ? <h2 className="font-medium">{post.title}</h2> : null}
              <p className="mt-2 whitespace-pre-wrap text-sm">
                {renderStructuredBody(post.bodyJson)}
              </p>
              {verifyLinks.length > 0 ? (
                <ul className="mt-2 space-y-1 text-sm">
                  {verifyLinks.map((link) => (
                    <li key={link}>
                      <Link href={link} className="underline">
                        Verify credential
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                <Link href={`/community/posts/${post.id}`} className="underline">
                  {post.commentCount ?? 0} comments
                </Link>
                <button
                  type="button"
                  className="underline"
                  onClick={() => void toggleReaction(post.id)}
                >
                  React{" "}
                  {post.reactionCounts?.["like"] ? ` (${String(post.reactionCounts["like"])})` : ""}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
