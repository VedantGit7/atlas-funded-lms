"use client";

import { useEffect, useState } from "react";
import type { z } from "zod";
import { ClientApiError, clientApi } from "../../lib/client-api";
import { renderStructuredBody } from "../community/components/structured-body";
import type { structuredBodySchema } from "@atlas/contracts/community/community.dto";

type StructuredBody = z.infer<typeof structuredBodySchema>;

type CommentItem = {
  id: string;
  authorMembershipId: string;
  bodyJson: StructuredBody;
};

type LessonCommentsPanelProps = {
  lessonId: string;
};

export function LessonCommentsPanel({ lessonId }: LessonCommentsPanelProps) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    void clientApi
      .get<{ data: { items: CommentItem[] } }>(`/api/v1/lessons/${lessonId}/comments`)
      .then((response) => {
        setComments(response.data.items);
      })
      .catch((loadError: unknown) => {
        setComments([]);
        if (loadError instanceof ClientApiError) {
          setError(loadError.message);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [lessonId]);

  async function submitComment() {
    const text = draft.trim();
    if (!text || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const bodyJson: StructuredBody = {
        version: 1,
        blocks: [{ type: "paragraph", children: [{ type: "text", text }] }],
      };
      const response = await clientApi.post<{ data: CommentItem }>(
        `/api/v1/lessons/${lessonId}/comments`,
        { bodyJson },
        "lesson-comment-create",
      );
      setComments((current) => [...current, response.data]);
      setDraft("");
    } catch (submitError) {
      setError(
        submitError instanceof ClientApiError ? submitError.message : "Unable to post comment.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="space-y-4 rounded border p-4">
      <h2 className="text-lg font-semibold">Comments</h2>
      {loading ? <p className="text-sm opacity-70">Loading comments…</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
      <ul className="space-y-3">
        {comments.map((comment) => (
          <li key={comment.id} className="rounded-md border bg-muted/30 p-3 text-sm">
            {renderStructuredBody(comment.bodyJson)}
          </li>
        ))}
      </ul>
      <div className="space-y-2">
        <textarea
          className="min-h-[5rem] w-full rounded-md border bg-background px-3 py-2 text-sm"
          placeholder="Add a comment"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
        />
        <button
          type="button"
          className="rounded-md border bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
          disabled={submitting || !draft.trim()}
          onClick={() => {
            void submitComment();
          }}
        >
          {submitting ? "Posting…" : "Post comment"}
        </button>
      </div>
    </section>
  );
}
