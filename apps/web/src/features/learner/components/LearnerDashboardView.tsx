import Link from "next/link";
import { ReadinessBandHeader } from "../../readiness/components/ReadinessBandHeader";
import { EDUCATIONAL_READINESS_COPY } from "../copy/learner-copy";
import type {
  CompositeReadinessProjection,
  LegalCopyConfig,
} from "../../../server/readiness/readiness.types";

export type LearnerDashboardViewProps = {
  displayName: string | null;
  composite: CompositeReadinessProjection | null;
  legalCopy: LegalCopyConfig | null;
  nextAction: {
    label: string;
    href: string;
  };
  continueLearning: {
    title: string;
    href: string;
  } | null;
  practiceHref: string;
  streakCount: number | null;
  xpTotal: number | null;
};

export function LearnerDashboardView({
  displayName,
  composite,
  legalCopy,
  nextAction,
  continueLearning,
  practiceHref,
  streakCount,
  xpTotal,
}: LearnerDashboardViewProps) {
  const greeting = displayName?.trim() ? `Welcome back, ${displayName}` : "Welcome back";

  return (
    <main className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">{greeting}</h1>
        <p className="text-sm opacity-80">{EDUCATIONAL_READINESS_COPY}</p>
      </header>

      <ReadinessBandHeader composite={composite} legalCopy={legalCopy} />

      <section className="rounded-lg border p-4" aria-label="Next best action">
        <h2 className="text-lg font-semibold">Next best action</h2>
        <p className="mt-1 text-sm opacity-80">{nextAction.label}</p>
        <Link
          href={nextAction.href}
          className="mt-3 inline-flex rounded-md border px-4 py-2 text-sm font-medium"
        >
          Continue
        </Link>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {continueLearning ? (
          <section className="rounded-lg border p-4">
            <h2 className="font-semibold">Continue learning</h2>
            <p className="mt-1 text-sm opacity-80">{continueLearning.title}</p>
            <Link href={continueLearning.href} className="mt-3 inline-block text-sm underline">
              Resume
            </Link>
          </section>
        ) : (
          <section className="rounded-lg border p-4">
            <h2 className="font-semibold">Continue learning</h2>
            <p className="mt-1 text-sm opacity-80">Browse the catalog to start a course.</p>
            <Link href="/courses" className="mt-3 inline-block text-sm underline">
              Open catalog
            </Link>
          </section>
        )}

        <section className="rounded-lg border p-4">
          <h2 className="font-semibold">Recommended practice</h2>
          <p className="mt-1 text-sm opacity-80">Review due cards in swipe practice.</p>
          <Link href={practiceHref} className="mt-3 inline-block text-sm underline">
            Open practice
          </Link>
        </section>
      </div>

      {(streakCount != null || xpTotal != null) && (
        <section className="grid gap-4 sm:grid-cols-2">
          {streakCount != null ? (
            <div className="rounded-lg border p-4">
              <p className="text-sm opacity-70">Learning streak</p>
              <p className="text-2xl font-semibold">{streakCount}</p>
            </div>
          ) : null}
          {xpTotal != null ? (
            <div className="rounded-lg border p-4">
              <p className="text-sm opacity-70">Experience points</p>
              <p className="text-2xl font-semibold">{xpTotal}</p>
            </div>
          ) : null}
        </section>
      )}

      <nav aria-label="Quick links" className="flex flex-wrap gap-3 text-sm">
        <Link href="/roadmap" className="underline">
          Roadmap
        </Link>
        <Link href="/readiness" className="underline">
          Readiness
        </Link>
        <Link href="/progress" className="underline">
          Progress
        </Link>
      </nav>
    </main>
  );
}
