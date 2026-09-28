"use client";

import { useMemo, useState } from "react";
import { FadePresence } from "../../../components/motion/FadePresence";
import { CornerDownRight, Pencil, Trash2 } from "lucide-react";
import { cn } from "@atlas/design-system";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import {
  authorDisplayName,
  avatarTint,
  buildCommentTree,
  initials,
  relativeTime,
  roleBadge,
  type CommunityAuthor,
} from "../community-view";
import { renderStructuredBody } from "./structured-body";
import { ReactionToggle } from "./ReactionToggle";
import { ReportContentDialog } from "./ReportContentDialog";
import { SubmitAppealDialog } from "./SubmitAppealDialog";
import type { z } from "zod";
import type { structuredBodySchema } from "@atlas/contracts/community/community.dto";

type StructuredBody = z.infer<typeof structuredBodySchema>;

export type CommentItem = {
  id: string;
  parentCommentId?: string | null;
  authorMembershipId: string;
  author?: CommunityAuthor | undefined;
  bodyJson: StructuredBody;
  reactionCounts?: Record<string, number> | undefined;
  viewerReactionKeys?: string[] | undefined;
  appealableModerationCaseId?: string | null | undefined;
  createdAt: string;
};

type Viewer = { membershipId: string; displayName: string | null };

type CommentTreeProps = {
  postId: string;
  postAuthorMembershipId: string;
  viewer: Viewer;
  initialComments: CommentItem[];
  onCountChange?: (count: number) => void;
};

const MAX_INDENT_DEPTH = 4;

function toBody(text: string): StructuredBody {
  return { version: 1, blocks: [{ type: "paragraph", children: [{ type: "text", text }] }] };
}

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold",
        avatarTint(name),
        size === "sm" ? "h-8 w-8 text-[11px]" : "h-10 w-10 text-xs",
      )}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

function CommentComposer({
  viewerName,
  onSubmit,
  placeholder,
  submitLabel,
  initialValue = "",
  autoFocus = false,
  onCancel,
  compact = false,
}: {
  viewerName: string;
  onSubmit: (text: string) => Promise<void>;
  placeholder: string;
  submitLabel: string;
  initialValue?: string;
  autoFocus?: boolean;
  onCancel?: () => void;
  compact?: boolean;
}) {
  const [draft, setDraft] = useState(initialValue);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const text = draft.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(text);
      setDraft("");
    } catch (submitError) {
      setError(
        submitError instanceof ClientApiError ? submitError.message : "Unable to post right now.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={cn("flex gap-3", compact ? "" : "")}>
      {!compact ? <Avatar name={viewerName} size="sm" /> : null}
      <div className="min-w-0 flex-1">
        <textarea
          className="min-h-[44px] w-full resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={draft}
          placeholder={placeholder}
          autoFocus={autoFocus}
          rows={compact ? 2 : 3}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              void submit();
            }
          }}
        />
        {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-[filter] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            disabled={submitting || draft.trim().length === 0}
            onClick={() => void submit()}
          >
            {submitting ? "Posting…" : submitLabel}
          </button>
          {onCancel ? (
            <button
              type="button"
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
              onClick={onCancel}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function CommentTree({
  postId,
  postAuthorMembershipId,
  viewer,
  initialComments,
  onCountChange,
}: CommentTreeProps) {
  const [comments, setComments] = useState<CommentItem[]>(initialComments);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const viewerName = authorDisplayName(
    { membershipId: viewer.membershipId, displayName: viewer.displayName, roleKey: null },
    viewer.membershipId,
  );

  const tree = useMemo(() => buildCommentTree(comments), [comments]);

  function updateComments(next: CommentItem[]) {
    setComments(next);
    onCountChange?.(next.length);
  }

  async function addComment(text: string, parentCommentId?: string) {
    const response = await clientApi.post<{ data: CommentItem }>(
      `/api/v1/posts/${postId}/comments`,
      parentCommentId ? { bodyJson: toBody(text), parentCommentId } : { bodyJson: toBody(text) },
      "community-comment",
    );
    updateComments([...comments, response.data]);
    setReplyingToId(null);
  }

  async function saveComment(commentId: string, text: string) {
    const response = await clientApi.put<{ data: CommentItem }>(
      `/api/v1/comments/${commentId}`,
      { bodyJson: toBody(text) },
      "community-comment-update",
    );
    updateComments(comments.map((comment) => (comment.id === commentId ? response.data : comment)));
    setEditingId(null);
  }

  async function removeComment(commentId: string) {
    await clientApi.delete(`/api/v1/comments/${commentId}`, "community-comment-delete");
    updateComments(comments.filter((comment) => comment.id !== commentId));
  }

  function renderNode(node: (typeof tree)[number], depth: number) {
    const isOwn = node.authorMembershipId === viewer.membershipId;
    const isPostAuthor = node.authorMembershipId === postAuthorMembershipId;
    const name = authorDisplayName(node.author, node.authorMembershipId);
    const badge = roleBadge(node.author?.roleKey);
    const isEditing = editingId === node.id;
    const isReplying = replyingToId === node.id;

    return (
      <li key={node.id} className="relative">
        <div className="flex gap-3">
          <Avatar name={name} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="text-sm font-semibold text-foreground">{name}</span>
              {isPostAuthor ? (
                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                  Author
                </span>
              ) : badge ? (
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {badge.label}
                </span>
              ) : null}
              <span className="text-[11px] text-muted-foreground">
                {relativeTime(node.createdAt)}
              </span>
            </div>

            {isEditing ? (
              <div className="mt-2">
                <CommentComposer
                  viewerName={viewerName}
                  compact
                  initialValue={renderStructuredBody(node.bodyJson)}
                  placeholder="Edit your comment"
                  submitLabel="Save"
                  autoFocus
                  onSubmit={(text) => saveComment(node.id, text)}
                  onCancel={() => {
                    setEditingId(null);
                  }}
                />
              </div>
            ) : (
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                {renderStructuredBody(node.bodyJson)}
              </p>
            )}

            {!isEditing ? (
              <div className="mt-2 flex flex-wrap items-center gap-4">
                <ReactionToggle
                  variant="inline"
                  targetType="comment"
                  targetId={node.id}
                  initialCount={node.reactionCounts?.["like"] ?? 0}
                  initialViewerReactionKeys={node.viewerReactionKeys ?? []}
                />
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
                  onClick={() => {
                    setReplyingToId(isReplying ? null : node.id);
                  }}
                >
                  <CornerDownRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                  Reply
                </button>
                {isOwn ? (
                  <>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                      onClick={() => {
                        setEditingId(node.id);
                        setReplyingToId(null);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                      Edit
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-destructive"
                      onClick={() => void removeComment(node.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                      Delete
                    </button>
                  </>
                ) : (
                  <ReportContentDialog variant="icon" targetType="comment" targetId={node.id} />
                )}
              </div>
            ) : null}

            {isOwn && node.appealableModerationCaseId ? (
              <div className="mt-3">
                <SubmitAppealDialog moderationCaseId={node.appealableModerationCaseId} />
              </div>
            ) : null}

            <FadePresence open={isReplying} duration={180} offset={-4} className="mt-3">
              <CommentComposer
                viewerName={viewerName}
                compact
                autoFocus
                placeholder={`Reply to ${name}`}
                submitLabel="Reply"
                onSubmit={(text) => addComment(text, node.id)}
                onCancel={() => {
                  setReplyingToId(null);
                }}
              />
            </FadePresence>

            {node.replies.length > 0 ? (
              <ul
                className={cn(
                  "mt-4 space-y-4 border-l border-border/70",
                  depth + 1 <= MAX_INDENT_DEPTH ? "pl-4" : "pl-2",
                )}
              >
                {node.replies.map((child) => renderNode(child, depth + 1))}
              </ul>
            ) : null}
          </div>
        </div>
      </li>
    );
  }

  return (
    <div className="space-y-5">
      <CommentComposer
        viewerName={viewerName}
        placeholder="Share your perspective…"
        submitLabel="Comment"
        onSubmit={(text) => addComment(text)}
      />

      {tree.length > 0 ? (
        <ul className="space-y-5">{tree.map((node) => renderNode(node, 0))}</ul>
      ) : (
        <p className="text-sm text-muted-foreground">No comments yet. Be the first to weigh in.</p>
      )}
    </div>
  );
}
