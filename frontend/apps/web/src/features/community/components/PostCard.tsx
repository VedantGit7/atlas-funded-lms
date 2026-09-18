"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { BadgeCheck, MessageSquare } from "lucide-react";
import { cn } from "@atlas/design-system";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import {
  authorDisplayName,
  avatarTint,
  initials,
  relativeTime,
  roleBadge,
  type CommunityAuthor,
} from "../community-view";
import { collectVerifyLinks, renderStructuredBody } from "./structured-body";
import { CommentTree, type CommentItem } from "./CommentTree";
import { ReactionToggle } from "./ReactionToggle";
import { ReportContentDialog } from "./ReportContentDialog";
import { SubmitAppealDialog } from "./SubmitAppealDialog";
import type { z } from "zod";
import type { structuredBodySchema } from "@atlas/contracts/community/community.dto";

type StructuredBody = z.infer<typeof structuredBodySchema>;

export type FeedPost = {
  id: string;
  title: string | null;
  bodyJson: StructuredBody;
  authorMembershipId: string;
  author?: CommunityAuthor | undefined;
  createdAt: string;
  commentCount?: number | undefined;
  reactionCounts?: Record<string, number> | undefined;
  viewerReactionKeys?: string[] | undefined;
  appealableModerationCaseId?: string | null | undefined;
};

type PostCardProps = {
  post: FeedPost;
  viewer: { membershipId: string; displayName: string | null };
  defaultExpanded?: boolean;
  initialComments?: CommentItem[];
};

export function PostCard({
  post,
  viewer,
  defaultExpanded = false,
  initialComments,
}: PostCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [comments, setComments] = useState<CommentItem[] | null>(initialComments ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commentCount, setCommentCount] = useState(
    post.commentCount ?? initialComments?.length ?? 0,
  );
  const reduceMotion = useReducedMotion();

  const isOwn = post.authorMembershipId === viewer.membershipId;
  const name = authorDisplayName(post.author, post.authorMembershipId);
  const badge = roleBadge(post.author?.roleKey);
  const verifyLinks = collectVerifyLinks(post.bodyJson);

  async function toggleComments() {
    const next = !expanded;
    setExpanded(next);
    if (next && comments === null && !loading) {
      setLoading(true);
      setError(null);
      try {
        const response = await clientApi.get<{ data: { items: CommentItem[] } }>(
          `/api/v1/posts/${post.id}/comments`,
        );
        setComments(response.data.items);
        setCommentCount(response.data.items.length);
      } catch (fetchError) {
        setError(
          fetchError instanceof ClientApiError
            ? fetchError.message
            : "Unable to load comments right now.",
        );
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                avatarTint(name),
              )}
              aria-hidden="true"
            >
              {initials(name)}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <p className="text-sm font-semibold text-foreground">{name}</p>
                {badge ? (
                  <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                    {badge.label}
                  </span>
                ) : null}
              </div>
              <p className="text-[11px] text-muted-foreground">{relativeTime(post.createdAt)}</p>
            </div>
          </div>
          {!isOwn ? (
            <ReportContentDialog variant="button" targetType="post" targetId={post.id} />
          ) : null}
        </div>

        {post.title ? (
          <h3 className="mt-4 text-lg font-semibold tracking-tight text-foreground">
            {post.title}
          </h3>
        ) : null}

        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
          {renderStructuredBody(post.bodyJson)}
        </p>

        {verifyLinks.length > 0 ? (
          <ul className="mt-3 space-y-1.5">
            {verifyLinks.map((link) => (
              <li key={link}>
                <Link
                  href={link}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                  <BadgeCheck className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                  Verify credential
                </Link>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <ReactionToggle
            targetType="post"
            targetId={post.id}
            initialCount={post.reactionCounts?.["like"] ?? 0}
            initialViewerReactionKeys={post.viewerReactionKeys ?? []}
          />
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              expanded
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
            aria-expanded={expanded}
            onClick={() => void toggleComments()}
          >
            <MessageSquare className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            <span className="tabular-nums">{commentCount}</span>
            <span className="hidden sm:inline">{commentCount === 1 ? "Comment" : "Comments"}</span>
          </button>
        </div>

        {isOwn && post.appealableModerationCaseId ? (
          <div className="mt-4">
            <SubmitAppealDialog moderationCaseId={post.appealableModerationCaseId} />
          </div>
        ) : null}
      </div>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-border bg-muted/30 px-5 py-6 sm:px-6"
          >
            {loading ? (
              <div className="space-y-3" aria-hidden="true">
                {[0, 1].map((index) => (
                  <div key={index} className="flex gap-3">
                    <div className="h-8 w-8 rounded-full bg-muted motion-safe:animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-32 rounded bg-muted motion-safe:animate-pulse" />
                      <div className="h-3 w-full rounded bg-muted motion-safe:animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : comments ? (
              <CommentTree
                postId={post.id}
                postAuthorMembershipId={post.authorMembershipId}
                viewer={viewer}
                initialComments={comments}
                onCountChange={setCommentCount}
              />
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </article>
  );
}
