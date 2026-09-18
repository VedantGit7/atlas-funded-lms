import Link from "next/link";

export type ContinueLearningCardProps = {
  title: string;
  href: string;
  subtitle?: string | null;
  progressPct?: number | null;
  kind?: "path" | "course";
};

export function ContinueLearningCard({
  title,
  href,
  subtitle,
  progressPct,
  kind = "path",
}: ContinueLearningCardProps) {
  const kindLabel = kind === "course" ? "Course" : "Learning path";

  return (
    <section className="rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide opacity-60">{kindLabel}</p>
          <h2 className="font-semibold">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm opacity-80">{subtitle}</p> : null}
        </div>
        {progressPct != null ? (
          <span className="text-sm font-medium tabular-nums">{progressPct}%</span>
        ) : null}
      </div>
      {progressPct != null ? (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
          <div
            className="h-full rounded-full bg-current opacity-70"
            style={{ width: `${String(Math.min(100, Math.max(0, progressPct)))}%` }}
            role="progressbar"
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      ) : null}
      <Link
        href={href}
        className="mt-4 inline-flex rounded-md border px-4 py-2 text-sm font-medium"
      >
        Resume
      </Link>
    </section>
  );
}
