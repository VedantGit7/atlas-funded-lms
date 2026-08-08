import Link from "next/link";

type GamificationSummaryCardProps = {
  levelKey: string | null;
  xpTotal: number;
  streakCount: number;
};

export function GamificationSummaryCard({
  levelKey,
  xpTotal,
  streakCount,
}: GamificationSummaryCardProps) {
  return (
    <article className="rounded border p-4">
      <h2 className="text-base font-semibold">Achievements</h2>
      <dl className="mt-2 grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="opacity-70">Level</dt>
          <dd className="font-medium">{levelKey ?? "—"}</dd>
        </div>
        <div>
          <dt className="opacity-70">XP</dt>
          <dd className="font-medium">{xpTotal}</dd>
        </div>
        <div>
          <dt className="opacity-70">Streak</dt>
          <dd className="font-medium">{streakCount}</dd>
        </div>
      </dl>
      <Link href="/achievements" className="mt-3 inline-block text-sm underline">
        View achievements
      </Link>
    </article>
  );
}
