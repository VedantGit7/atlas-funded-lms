import { Download, Lock, Medal } from "lucide-react";
import { badgeIconByKey } from "../badge-icons";
import { formatEarnedDate } from "../gamification-view";

type BadgeCriterionProgress = {
  criteria:
    | { type: "xp_total"; minXp: number }
    | { type: "streak_current"; streakKey: string; minCount: number }
    | { type: "event_count"; eventType: string; minCount: number };
  progress: number;
  target: number;
};

type BadgeGridBadge = {
  id: string;
  key: string;
  name: string;
  iconKey: string | null;
  awarded?: boolean | undefined;
  awardedAt?: string | null | undefined;
  operator?: "all" | "any" | undefined;
  progress?: BadgeCriterionProgress[] | undefined;
};

type BadgeGridProps = {
  badges: BadgeGridBadge[];
};

function unitFor(entry: BadgeCriterionProgress): string {
  if (entry.criteria.type === "xp_total") return "XP";
  if (entry.criteria.type === "streak_current") return "days";
  return "done";
}

/**
 * Collapses a badge's criteria into one progress bar. For "all" the driver is
 * the least-complete criterion (that gates the award); for "any" it's the most
 * complete. Returns null when the badge has no measurable progress.
 */
function drivingProgress(badge: BadgeGridBadge): { percent: number; label: string } | null {
  if (!badge.progress || badge.progress.length === 0) return null;

  const ratios = badge.progress.map((entry) => ({
    entry,
    ratio: entry.target > 0 ? Math.min(1, Math.max(0, entry.progress) / entry.target) : 0,
  }));

  const driver =
    badge.operator === "any"
      ? ratios.reduce((best, current) => (current.ratio > best.ratio ? current : best))
      : ratios.reduce((worst, current) => (current.ratio < worst.ratio ? current : worst));

  return {
    percent: Math.round(driver.ratio * 100),
    label: `${String(driver.entry.progress)}/${String(driver.entry.target)} ${unitFor(driver.entry)}`,
  };
}

const cardBase =
  "flex flex-col items-center rounded-xl border p-4 text-center motion-safe:transition-[transform,box-shadow] motion-safe:duration-200";

function EmptyBadges() {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-muted/40 px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Medal className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
      </span>
      <p className="mt-4 text-sm font-semibold text-foreground">No badges yet</p>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground">
        Complete lessons, keep your streak, and pass assessments to start earning badges.
      </p>
    </div>
  );
}

export function BadgeGrid({ badges }: BadgeGridProps) {
  const earnedCount = badges.filter((badge) => badge.awarded).length;

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">Badge gallery</h2>
        {badges.length > 0 ? (
          <span className="text-xs font-medium text-muted-foreground tabular-nums">
            {earnedCount} of {badges.length} earned
          </span>
        ) : null}
      </div>

      {badges.length === 0 ? (
        <EmptyBadges />
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {badges.map((badge) => {
            const Icon = badgeIconByKey(badge.iconKey);

            if (badge.awarded) {
              return (
                <li
                  key={badge.id}
                  className={`${cardBase} border-border bg-card motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-md`}
                >
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon className="h-8 w-8" strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <h3 className="mt-3 line-clamp-2 text-sm font-semibold text-foreground">
                    {badge.name}
                  </h3>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {formatEarnedDate(badge.awardedAt)}
                  </p>
                  <a
                    href={`/api/v1/me/badges/${encodeURIComponent(badge.key)}/open-badge`}
                    download
                    className="mt-3 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Download className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                    Open Badge
                  </a>
                </li>
              );
            }

            const progress = drivingProgress(badge);

            return (
              <li
                key={badge.id}
                className={`${cardBase} border-dashed border-border bg-muted/30`}
              >
                <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-muted text-muted-foreground opacity-70">
                  <Icon className="h-8 w-8" strokeWidth={1.75} aria-hidden="true" />
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
                    <Lock className="h-2.5 w-2.5" strokeWidth={2.5} aria-hidden="true" />
                  </span>
                </span>
                <h3 className="mt-3 line-clamp-2 text-sm font-semibold text-muted-foreground">
                  {badge.name}
                </h3>
                {progress ? (
                  <div className="mt-2 w-full">
                    <div
                      className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={progress.percent}
                      aria-label={`${badge.name} progress`}
                    >
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${String(progress.percent)}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                      {progress.label}
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 text-[11px] text-muted-foreground">Locked</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
