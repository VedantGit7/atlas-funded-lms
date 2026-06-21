import Link from "next/link";
import { collectVerifyLinks, renderStructuredBody } from "./structured-body";
import {
  HALL_OF_FAME_DISCLAIMER,
  formatHallOfFameLeaderboardUnavailable,
} from "../../learner/copy/learner-copy";
import type { z } from "zod";
import type { structuredBodySchema } from "../../../server/community/community.dto";

type StructuredBody = z.infer<typeof structuredBodySchema>;

type HallOfFameViewProps = {
  posts: Array<{
    id: string;
    title: string | null;
    bodyJson: StructuredBody;
  }>;
  leaderboard: {
    periodKey: string;
    entries: Array<{ rank: number; label: string; metricValue: number; isSelf: boolean }>;
  } | null;
  gamificationAvailable: boolean;
};

export function HallOfFameView({ posts, leaderboard, gamificationAvailable }: HallOfFameViewProps) {
  return (
    <div className="space-y-8">
      <p className="text-sm opacity-80">{HALL_OF_FAME_DISCLAIMER}</p>
      <section className="space-y-4">
        <h2 className="text-lg font-medium">Recognition feed</h2>
        {posts.length === 0 ? (
          <p className="text-sm opacity-80">No recognition posts are configured yet.</p>
        ) : (
          <ul className="space-y-4">
            {posts.map((post) => {
              const verifyLinks = collectVerifyLinks(post.bodyJson);
              return (
                <li key={post.id} className="rounded-lg border p-4">
                  {post.title ? <h3 className="font-medium">{post.title}</h3> : null}
                  <p className="mt-2 whitespace-pre-wrap text-sm">
                    {renderStructuredBody(post.bodyJson)}
                  </p>
                  {verifyLinks.map((link) => (
                    <p key={link} className="mt-2 text-sm">
                      <Link href={link} className="underline">
                        Verify credential
                      </Link>
                    </p>
                  ))}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Top performers</h2>
        {!gamificationAvailable ? (
          <p className="text-sm opacity-80">{formatHallOfFameLeaderboardUnavailable()}</p>
        ) : leaderboard && leaderboard.entries.length > 0 ? (
          <ol className="space-y-2 text-sm">
            {leaderboard.entries.map((entry) => (
              <li key={entry.rank} className="flex justify-between rounded border px-3 py-2">
                <span>
                  #{entry.rank} {entry.label}
                </span>
                <span>{entry.metricValue}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm opacity-80">No leaderboard snapshot is available yet.</p>
        )}
      </section>
    </div>
  );
}
