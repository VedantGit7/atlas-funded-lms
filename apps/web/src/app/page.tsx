import { notFound, redirect } from "next/navigation";
import { PublicSiteShell } from "../components/shells/PublicSiteShell";
import { LearnerShellGate } from "../components/shells/LearnerShellGate";
import { PageGate } from "../components/patterns/PageGate";
import { LearnerDashboardView } from "../features/learner/components/LearnerDashboardView";
import { PublicLandingView } from "../features/learner/components/PublicLandingView";
import { loadPublicTenantBranding } from "../lib/server/public-tenant-branding";
import { runTenantStateGate } from "../lib/server/tenant-state-gate";
import { ServerApiError, serverApi } from "../lib/server-api";
import { competencyServerApi } from "../modules/competency/competency.server-api";
import { gamificationServerApi } from "../modules/gamification/gamification.server-api";
import { readinessServerApi } from "../modules/readiness/readiness.server-api";
import { deriveProminence } from "../server/readiness/readiness.schemas";
import { DEFAULT_COMPOSITE_KEY } from "../server/readiness/readiness.types";
import type { z } from "zod";
import type {
  learningPathListResponseSchema,
  pathProgressResponseSchema,
} from "../server/learning-paths/learning-path.schemas";

type LearningPathListResponse = z.infer<typeof learningPathListResponseSchema>;
type PathProgressResponse = z.infer<typeof pathProgressResponseSchema>;

export default async function HomePage() {
  const gate = await runTenantStateGate();

  if (gate.kind === "not_found") {
    notFound();
  }

  if (gate.kind === "unavailable") {
    redirect(`/tenant-unavailable?reason=${gate.reason}`);
  }

  const branding = await loadPublicTenantBranding({
    tenantId: gate.tenant.tenantId,
    requestId: gate.tenant.requestId,
  });

  try {
    const [me, competency, gamification, streaks, policyResponse, paths] = await Promise.all([
      serverApi.get<{
        data: {
          membership: { id: string };
          profile: { displayName: string | null } | null;
        };
      }>("/api/v1/me"),
      competencyServerApi.getMyCompetency(),
      gamificationServerApi.getMyGamification().catch(() => null),
      gamificationServerApi.getMyStreaks().catch(() => null),
      readinessServerApi.getReadinessPolicy().catch(() => null),
      serverApi
        .get<LearningPathListResponse>("/api/v1/learning-paths?type=roadmap&limit=1")
        .catch(() => null),
    ]);

    const policy = policyResponse?.data ?? null;
    const composite =
      competency.data.composites.find((entry) => entry.compositeKey === DEFAULT_COMPOSITE_KEY) ??
      competency.data.composites[0] ??
      null;

    const compositeProjection =
      composite && policy
        ? {
            compositeKey: composite.compositeKey,
            scoringProfileId: composite.scoringProfileId,
            score: composite.score,
            bandKey: composite.bandKey,
            prominence: deriveProminence(composite.bandKey, policy.ctaPolicy.bandProminenceRules),
            calculatedAt: composite.calculatedAt,
          }
        : composite
          ? {
              compositeKey: composite.compositeKey,
              scoringProfileId: composite.scoringProfileId,
              score: composite.score,
              bandKey: composite.bandKey,
              prominence: "hidden" as const,
              calculatedAt: composite.calculatedAt,
            }
          : null;

    const roadmap = paths?.data.items[0] ?? null;
    let nextAction = { label: "Browse the course catalog", href: "/courses" };
    let continueLearning: { title: string; href: string } | null = null;

    if (roadmap) {
      try {
        const progress = await serverApi.get<PathProgressResponse>(
          `/api/v1/learning-paths/${roadmap.id}/progress`,
        );
        const currentStep = progress.data.steps.find(
          (step) => step.stepId === progress.data.currentStepId,
        );
        nextAction = {
          label: progress.data.nextAction.label,
          href: currentStep?.href ?? `/paths/${roadmap.id}`,
        };
        continueLearning = {
          title: roadmap.title,
          href: `/paths/${roadmap.id}`,
        };
      } catch {
        continueLearning = {
          title: roadmap.title,
          href: `/paths/${roadmap.id}`,
        };
      }
    }

    const dailyStreak =
      streaks?.data.items.find((item) => item.streakKey === "daily_learning") ??
      streaks?.data.items[0] ??
      null;

    return (
      <LearnerShellGate>
        <PageGate state="ready" title="Dashboard">
          <LearnerDashboardView
            displayName={me.data.profile?.displayName ?? null}
            composite={compositeProjection}
            legalCopy={policy?.legalCopy ?? null}
            nextAction={nextAction}
            continueLearning={continueLearning}
            practiceHref="/swipe"
            streakCount={dailyStreak?.currentCount ?? null}
            xpTotal={gamification?.data.xpTotal ?? null}
          />
        </PageGate>
      </LearnerShellGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && error.status === 401) {
      return (
        <PublicSiteShell title={branding.publicName ?? "Atlas Academy"}>
          <PublicLandingView branding={branding} requestId={gate.tenant.requestId} />
        </PublicSiteShell>
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <PublicSiteShell title={branding.publicName ?? "Atlas Academy"}>
          <main>
            <h1>Welcome</h1>
            <p role="alert">Unable to load your dashboard. Request ID: {error.requestId}</p>
            <p className="mt-4">
              <a href="/login">Sign in</a>
            </p>
          </main>
        </PublicSiteShell>
      );
    }

    throw error;
  }
}
