import Link from "next/link";
import { Award, BadgeCheck } from "lucide-react";
import { HallOfFameLeaderboard } from "./HallOfFameLeaderboard";
import { collectVerifyLinks, renderStructuredBody } from "./structured-body";
import {
  type HallOfFameBoard,
  type HallOfFameLeaderboardDetail,
  formatSnapshotDate,
  storyExcerpt,
} from "../hall-of-fame-view";
import { ProgressReveal } from "../../progress/components/ProgressReveal";
import {
  HALL_OF_FAME_DISCLAIMER,
  formatHallOfFameLeaderboardUnavailable,
} from "../../learner/copy/learner-copy";
import type { z } from "zod";
import type { postDtoSchema } from "@atlas/contracts/community/community.dto";

type RecognitionPost = z.infer<typeof postDtoSchema>;

type HallOfFameViewProps = {
  posts: RecognitionPost[];
  leaderboard: HallOfFameLeaderboardDetail | null;
  boards: HallOfFameBoard[];
  gamificationAvailable: boolean;
};

export function HallOfFameView({
  posts,
  leaderboard,
  boards,
  gamificationAvailable,
}: HallOfFameViewProps) {
  return (
    <div className="space-y-12">
      <HallOfFameLeaderboard
        initialDetail={leaderboard}
        boards={boards}
        gamificationAvailable={gamificationAvailable}
        unavailableMessage={formatHallOfFameLeaderboardUnavailable()}
      />

      <section aria-label="Recognition stories" className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Recognition stories</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Consented milestones shared by learners across the community.
          </p>
        </div>

        {posts.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Award className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
            </span>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">No recognition stories yet</p>
              <p className="mx-auto max-w-sm text-sm text-muted-foreground">
                Milestone recognition posts will appear here as learners are celebrated.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {posts.map((post, index) => (
              <ProgressReveal key={post.id} delay={index < 4 ? index * 0.05 : 0}>
                <RecognitionStoryCard post={post} />
              </ProgressReveal>
            ))}
          </div>
        )}
      </section>

      <p className="border-t border-border pt-6 text-xs leading-relaxed text-muted-foreground">
        {HALL_OF_FAME_DISCLAIMER}
      </p>
    </div>
  );
}

function RecognitionStoryCard({ post }: { post: RecognitionPost }) {
  const excerpt = storyExcerpt(renderStructuredBody(post.bodyJson));
  const verifyLinks = collectVerifyLinks(post.bodyJson);
  const authorName = post.author?.displayName?.trim();
  const date = formatSnapshotDate(post.createdAt);

  return (
    <article className="flex h-full flex-col gap-4 rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/40">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Award className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {authorName && authorName.length > 0 ? authorName : "Recognized learner"}
          </p>
          {date ? <p className="text-xs text-muted-foreground">{date}</p> : null}
        </div>
      </div>

      {post.title ? (
        <h3 className="text-base font-semibold leading-snug text-foreground">{post.title}</h3>
      ) : null}

      {excerpt ? <p className="text-sm leading-relaxed text-muted-foreground">{excerpt}</p> : null}

      {verifyLinks.length > 0 ? (
        <div className="mt-auto flex flex-wrap gap-x-4 gap-y-2 pt-2">
          {verifyLinks.map((link) => (
            <Link
              key={link}
              href={link}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition-all hover:gap-2"
            >
              <BadgeCheck className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              Verify credential
            </Link>
          ))}
        </div>
      ) : null}
    </article>
  );
}
