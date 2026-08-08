"use client";

import { useState } from "react";
import { Check, Clock, MessageSquare, Plus, Users } from "lucide-react";
import { cn } from "@atlas/design-system";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import {
  authorDisplayName,
  avatarTint,
  formatCount,
  initials,
  spaceGlyph,
  visibilityMeta,
} from "../community-view";
import { PostCard, type FeedPost } from "./PostCard";

export type FeedSpace = {
  id: string;
  slug: string;
  name: string;
  visibility: string;
  isMember: boolean;
  postCount?: number | undefined;
  memberCount?: number | undefined;
};

type SpaceFeedProps = {
  space: FeedSpace;
  viewer: { membershipId: string; displayName: string | null };
  initialPosts: FeedPost[];
  onJoined?: (spaceId: string) => void;
};

export function SpaceFeed({ space, viewer, initialPosts, onJoined }: SpaceFeedProps) {
  const [posts, setPosts] = useState<FeedPost[]>(initialPosts);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [isMember, setIsMember] = useState(space.isMember);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const Glyph = spaceGlyph(space.slug || space.name);
  const visibility = visibilityMeta(space.visibility);
  const VisibilityIcon = visibility.icon;
  const viewerName = authorDisplayName(
    { membershipId: viewer.membershipId, displayName: viewer.displayName, roleKey: null },
    viewer.membershipId,
  );
  const memberCount = (space.memberCount ?? 0) + (isMember && !space.isMember ? 1 : 0);

  async function createPost() {
    const text = draft.trim();
    if (!text || submitting) return;

    setSubmitting(true);
    setPostError(null);

    try {
      const response = await clientApi.post<{ data: FeedPost }>(
        `/api/v1/spaces/${space.id}/posts`,
        {
          bodyJson: {
            version: 1,
            blocks: [{ type: "paragraph", children: [{ type: "text", text }] }],
          },
        },
        "community-post",
      );
      setPosts((current) => [response.data, ...current]);
      setDraft("");
    } catch (error) {
      setPostError(error instanceof ClientApiError ? error.message : "Unable to create post.");
    } finally {
      setSubmitting(false);
    }
  }

  async function join() {
    if (joining || isMember) return;
    setJoining(true);
    setJoinError(null);
    try {
      await clientApi.post(`/api/v1/spaces/${space.id}/join`, {}, "community-join");
      setIsMember(true);
      onJoined?.(space.id);
    } catch (error) {
      setJoinError(error instanceof ClientApiError ? error.message : "Unable to join this space.");
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Glyph className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
            </span>
            <h1 className="truncate text-2xl font-bold tracking-tight text-foreground">
              {space.name}
            </h1>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              {formatCount(memberCount)} {memberCount === 1 ? "member" : "members"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              {formatCount(space.postCount ?? posts.length)}{" "}
              {(space.postCount ?? posts.length) === 1 ? "post" : "posts"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <VisibilityIcon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              {visibility.label}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-start gap-1 sm:items-end">
          <button
            type="button"
            disabled={isMember || joining}
            onClick={() => void join()}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isMember
                ? "cursor-default border border-primary/30 text-primary"
                : "bg-primary text-primary-foreground hover:brightness-110 disabled:opacity-60",
            )}
          >
            {isMember ? (
              <>
                <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
                Joined
              </>
            ) : (
              <>{joining ? "Joining…" : "Join space"}</>
            )}
          </button>
          {joinError ? <p className="text-[11px] text-destructive">{joinError}</p> : null}
        </div>
      </header>

      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex gap-3">
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
              avatarTint(viewerName),
            )}
            aria-hidden="true"
          >
            {initials(viewerName)}
          </span>
          <div className="min-w-0 flex-1">
            <label htmlFor={`composer-${space.id}`} className="sr-only">
              Share with {space.name}
            </label>
            <textarea
              id={`composer-${space.id}`}
              className="min-h-[80px] w-full resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Share a new insight or question with the community…"
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
              }}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  void createPost();
                }
              }}
            />
            {postError ? <p className="mt-2 text-xs text-destructive">{postError}</p> : null}
            <div className="mt-3 flex items-center justify-end">
              <button
                type="button"
                disabled={submitting || draft.trim().length === 0}
                onClick={() => void createPost()}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-[filter] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              >
                <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
                {submitting ? "Posting…" : "Post"}
              </button>
            </div>
          </div>
        </div>
      </section>

      {posts.length > 0 ? (
        <div className="space-y-5">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} viewer={viewer} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Clock className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-sm font-semibold text-foreground">No posts yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Start the conversation. Share an insight or ask a question to get this space moving.
          </p>
        </div>
      )}
    </div>
  );
}
