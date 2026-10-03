"use client";

import { useMemo, useState } from "react";
import { Compass, Search, Users } from "lucide-react";
import { cn } from "@atlas/design-system";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import { formatCount, spaceGlyph } from "../community-view";
import { SpaceFeed, type FeedSpace } from "./SpaceFeed";
import type { FeedPost } from "./PostCard";

type CommunityExperienceProps = {
  spaces: FeedSpace[];
  viewer: { membershipId: string; displayName: string | null };
  initialActiveSpaceId: string | null;
  initialPosts: FeedPost[];
};

export function CommunityExperience({
  spaces: initialSpaces,
  viewer,
  initialActiveSpaceId,
  initialPosts,
}: CommunityExperienceProps) {
  const [spaces, setSpaces] = useState<FeedSpace[]>(initialSpaces);
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(
    initialActiveSpaceId ?? initialSpaces[0]?.id ?? null,
  );
  const [postsBySpace, setPostsBySpace] = useState<Record<string, FeedPost[] | undefined>>(
    initialActiveSpaceId ? { [initialActiveSpaceId]: initialPosts } : {},
  );
  const [loadingSpaceId, setLoadingSpaceId] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const activeSpace = spaces.find((space) => space.id === activeSpaceId) ?? null;

  const { joined, discover } = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = normalized
      ? spaces.filter((space) => space.name.toLowerCase().includes(normalized))
      : spaces;
    return {
      joined: filtered.filter((space) => space.isMember),
      discover: filtered.filter((space) => !space.isMember),
    };
  }, [spaces, query]);

  async function selectSpace(spaceId: string) {
    setActiveSpaceId(spaceId);
    if (postsBySpace[spaceId] !== undefined || loadingSpaceId === spaceId) return;

    setLoadingSpaceId(spaceId);
    setFetchError(null);
    try {
      const response = await clientApi.get<{ data: { items: FeedPost[] } }>(
        `/api/v1/spaces/${spaceId}/posts`,
      );
      setPostsBySpace((current) => ({ ...current, [spaceId]: response.data.items }));
    } catch (error) {
      setFetchError(
        error instanceof ClientApiError ? error.message : "Unable to load this space right now.",
      );
      setPostsBySpace((current) => ({ ...current, [spaceId]: [] }));
    } finally {
      setLoadingSpaceId(null);
    }
  }

  function handleJoined(spaceId: string) {
    setSpaces((current) =>
      current.map((space) =>
        space.id === spaceId
          ? { ...space, isMember: true, memberCount: (space.memberCount ?? 0) + 1 }
          : space,
      ),
    );
  }

  const activePosts = activeSpaceId ? postsBySpace[activeSpaceId] : undefined;
  const activeLoading = activeSpaceId != null && activePosts === undefined;

  if (spaces.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-16 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Compass className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
        </span>
        <h2 className="mt-4 text-base font-semibold text-foreground">No spaces yet</h2>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          Community spaces will appear here once your organization creates them.
        </p>
      </div>
    );
  }

  function renderRailRow(space: FeedSpace) {
    const Glyph = spaceGlyph(space.slug || space.name);
    const isActive = space.id === activeSpaceId;
    const count = space.memberCount ?? space.postCount ?? 0;
    return (
      <button
        key={space.id}
        type="button"
        aria-current={isActive ? "true" : undefined}
        onClick={() => void selectSpace(space.id)}
        className={cn(
          "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isActive
            ? "border-r-2 border-primary bg-primary/10 font-semibold text-primary"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <Glyph className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          <span className="truncate">{space.name}</span>
        </span>
        {count > 0 ? (
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/70">
            {formatCount(count)}
          </span>
        ) : null}
      </button>
    );
  }

  return (
    <div className="lg:grid lg:grid-cols-[264px_minmax(0,1fr)] lg:gap-8">
      <aside className="mb-6 lg:mb-0">
        {/* Desktop rail */}
        <div className="hidden lg:sticky lg:top-6 lg:block">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              strokeWidth={2}
              aria-hidden="true"
            />
            <label htmlFor="community-space-search" className="sr-only">
              Search spaces
            </label>
            <input
              id="community-space-search"
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
              }}
              placeholder="Search spaces"
              className="w-full rounded-full border border-input bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {joined.length > 0 ? (
            <div className="mt-5">
              <p className="px-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                Your spaces
              </p>
              <div className="mt-1.5 space-y-0.5">{joined.map(renderRailRow)}</div>
            </div>
          ) : null}

          {discover.length > 0 ? (
            <div className="mt-5">
              <p className="px-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                Discover
              </p>
              <div className="mt-1.5 space-y-0.5">{discover.map(renderRailRow)}</div>
            </div>
          ) : null}

          {joined.length === 0 && discover.length === 0 ? (
            <p className="mt-5 px-3 text-sm text-muted-foreground">No spaces match “{query}”.</p>
          ) : null}
        </div>

        {/* Mobile rail: horizontal chip scroller */}
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:hidden">
          {spaces.map((space) => {
            const Glyph = spaceGlyph(space.slug || space.name);
            const isActive = space.id === activeSpaceId;
            return (
              <button
                key={space.id}
                type="button"
                aria-current={isActive ? "true" : undefined}
                onClick={() => void selectSpace(space.id)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground",
                )}
              >
                <Glyph className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                {space.name}
              </button>
            );
          })}
        </div>
      </aside>

      <div className="min-w-0">
        {activeSpace ? (
          activeLoading ? (
            <FeedSkeleton />
          ) : (
            <>
              {fetchError ? (
                <p className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive-text">
                  {fetchError}
                </p>
              ) : null}
              <SpaceFeed
                key={activeSpace.id}
                space={activeSpace}
                viewer={viewer}
                initialPosts={activePosts ?? []}
                onJoined={handleJoined}
              />
            </>
          )
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-16 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Users className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
            </span>
            <h2 className="mt-4 text-base font-semibold text-foreground">Pick a space</h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Choose a space from the list to see its discussions.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div className="flex items-center justify-between gap-3 border-b border-border pb-6">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-muted motion-safe:animate-pulse" />
          <div className="space-y-2">
            <div className="h-6 w-48 rounded bg-muted motion-safe:animate-pulse" />
            <div className="h-3 w-56 rounded bg-muted motion-safe:animate-pulse" />
          </div>
        </div>
        <div className="h-9 w-28 rounded-full bg-muted motion-safe:animate-pulse" />
      </div>
      <div className="h-32 rounded-2xl border border-border bg-card motion-safe:animate-pulse" />
      {[0, 1].map((index) => (
        <div
          key={index}
          className="h-44 rounded-2xl border border-border bg-card motion-safe:animate-pulse"
        />
      ))}
    </div>
  );
}
