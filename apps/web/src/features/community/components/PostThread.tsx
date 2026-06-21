"use client";

import { useState } from "react";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import { renderStructuredBody } from "./structured-body";
import type { z } from "zod";
import type { structuredBodySchema } from "../../../server/community/community.dto";

type StructuredBody = z.infer<typeof structuredBodySchema>;

type PostThreadProps = {
  postId: string;
  postBody: StructuredBody;
  authorMembershipId: string;
  actorMembershipId: string;
  initialComments: Array<{
    id: string;
    authorMembershipId: string;
    bodyJson: StructuredBody;
  }>;
};

export function PostThread({
  postId,
  postBody,
  authorMembershipId,
  actorMembershipId,
  initialComments,
}: PostThreadProps) {
  const [comments, setComments] = useState(initialComments);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function addComment() {
    const text = draft.trim();
    if (!text) return;

    const bodyJson: StructuredBody = {
      version: 1,
      blocks: [{ type: "paragraph", children: [{ type: "text", text }] }],
    };

    try {
      const response = await clientApi.post<{ data: PostThreadProps["initialComments"][number] }>(
        `/api/v1/posts/${postId}/comments`,
        { bodyJson },
        "community-comment",
      );
      setComments((current) => [...current, response.data]);
      setDraft("");
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Unable to add comment.");
    }
  }

  async function saveComment(commentId: string) {
    const text = editDraft.trim();
    if (!text) return;

    const bodyJson: StructuredBody = {
      version: 1,
      blocks: [{ type: "paragraph", children: [{ type: "text", text }] }],
    };

    try {
      const response = await clientApi.put<{ data: PostThreadProps["initialComments"][number] }>(
        `/api/v1/comments/${commentId}`,
        { bodyJson },
        "community-comment-update",
      );
      setComments((current) =>
        current.map((comment) => (comment.id === commentId ? response.data : comment)),
      );
      setEditingId(null);
      setEditDraft("");
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Unable to update comment.");
    }
  }

  async function removeComment(commentId: string) {
    try {
      await clientApi.delete(`/api/v1/comments/${commentId}`, "community-comment-delete");
      setComments((current) => current.filter((comment) => comment.id !== commentId));
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Unable to delete comment.");
    }
  }

  return (
    <div className="space-y-6">
      <article className="rounded-lg border p-4">
        <p className="whitespace-pre-wrap text-sm">{renderStructuredBody(postBody)}</p>
        <p className="mt-2 text-xs opacity-60">Author: {authorMembershipId.slice(0, 8)}…</p>
      </article>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Comments</h2>
        <textarea
          className="min-h-20 w-full rounded border p-3 text-sm"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          placeholder="Add a comment"
        />
        <button
          type="button"
          className="rounded border px-4 py-2 text-sm"
          onClick={() => void addComment()}
        >
          Comment
        </button>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </section>

      <ul className="space-y-4">
        {comments.map((comment) => {
          const isOwn = comment.authorMembershipId === actorMembershipId;
          const isEditing = editingId === comment.id;

          return (
            <li key={comment.id} className="rounded border p-3">
              {isEditing ? (
                <textarea
                  className="min-h-20 w-full rounded border p-2 text-sm"
                  value={editDraft}
                  onChange={(event) => {
                    setEditDraft(event.target.value);
                  }}
                />
              ) : (
                <p className="whitespace-pre-wrap text-sm">
                  {renderStructuredBody(comment.bodyJson)}
                </p>
              )}
              {isOwn ? (
                <div className="mt-2 flex gap-3 text-sm">
                  {isEditing ? (
                    <button
                      type="button"
                      className="underline"
                      onClick={() => void saveComment(comment.id)}
                    >
                      Save
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="underline"
                      onClick={() => {
                        setEditingId(comment.id);
                        setEditDraft(renderStructuredBody(comment.bodyJson));
                      }}
                    >
                      Edit
                    </button>
                  )}
                  <button
                    type="button"
                    className="underline"
                    onClick={() => void removeComment(comment.id)}
                  >
                    Delete
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
