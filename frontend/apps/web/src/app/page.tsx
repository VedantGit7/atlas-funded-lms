import { Suspense } from "react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { PublicSiteShell } from "../components/shells/PublicSiteShell";
import { AtlasPlatformLanding } from "../features/public/components/atlas-landing/AtlasPlatformLanding";
import { resolvePlatformHost } from "../lib/server/platform-host-gate";
import { LearnerShellGate } from "../components/shells/LearnerShellGate";
import { PageGate } from "../components/patterns/PageGate";
import { LearnerDashboardView } from "../features/learner/components/LearnerDashboardView";
import { DashboardPersonalizedIsland } from "../features/learner/components/DashboardPersonalizedIsland";
import { loadLearnerDashboardData } from "../features/learner/components/dashboard/dashboard-data.server";
import { PublicLandingView } from "../features/public/components/PublicLandingView";
import { publicLandingServerApi } from "../modules/public/public-landing.server-api";
import { loadPublicTenantBranding } from "@atlas/tenant-branding";
import { runTenantStateGate } from "@atlas/tenant-gate";
import { ServerApiError, serverApi } from "../lib/server-api";
import { AchievementToastListener } from "../features/gamification/components/AchievementToastListener";

/** Roles that run dedicated consoles and must not land on the learner dashboard. */
const OPERATIONAL_ROLE_KEYS = ["owner", "admin", "instructor", "moderator"] as const;

/** True only for a pure student: present membership without any operational role. */
function isLearnerOnly(roleKeys: readonly string[]): boolean {
  return !roleKeys.some((key) => OPERATIONAL_ROLE_KEYS.includes(key as never));
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Operational roles (admin/owner/etc.) normally land on the public landing.
  // `?view=learner` is the admin "View as learner" preview entry point: it forces
  // the learner dashboard render for the current member.
  const previewLearner = (await searchParams)["view"] === "learner";

  // Platform plane (e.g. platform.localhost) has no tenant. Serve the Atlas LMS
  // marketing landing here instead of running the tenant gate (which 404s).
  const headerList = await headers();
  if (resolvePlatformHost(headerList.get("host") ?? "")) {
    return <AtlasPlatformLanding />;
  }

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

  const publicName = branding.publicName ?? "Academy";
  const requestId = gate.tenant.requestId;

  async function renderPublicLanding(authCta: { label: string; href: string } | null = null) {
    const landing = await publicLandingServerApi.getLanding("home");

    return (
      <PublicSiteShell
        variant="landing"
        publicName={publicName}
        logoLightUrl={branding.logoLightUrl}
        logoDarkUrl={branding.logoDarkUrl}
      >
        <PublicLandingView landing={landing.data} requestId={requestId} authCta={authCta} />
      </PublicSiteShell>
    );
  }

  try {
    type MeDashboardResponse = {
      data: {
        membership: { id: string; roleKeys?: string[] };
        profile: { displayName: string | null } | null;
      };
    };

    const me = await serverApi.get<MeDashboardResponse>("/api/v1/me");

    // Only a pure learner (student) lands on the learner dashboard here. Any
    // operational role (owner/admin/instructor/moderator) gets the public landing,
    // unless the admin explicitly requested the learner preview (`?view=learner`).
    const roleKeys = me.data.membership.roleKeys ?? [];
    if (!isLearnerOnly(roleKeys) && !previewLearner) {
      // Server-resolved session: show Dashboard instead of Sign In (no client flash).
      return await renderPublicLanding({ label: "Dashboard", href: "/admin" });
    }

    const dashboard = await loadLearnerDashboardData(me.data.profile?.displayName ?? null);

    return (
      <LearnerShellGate>
        <AchievementToastListener />
        <PageGate state="ready" title="Dashboard">
          <LearnerDashboardView
            data={dashboard}
            personalizedSection={
              // Streamed separately so a slow personalization call cannot block
              // the dashboard shell from rendering.
              <Suspense fallback={<PersonalizedSectionFallback />}>
                <DashboardPersonalizedIsland paths={null} />
              </Suspense>
            }
          />
        </PageGate>
      </LearnerShellGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && error.status === 401) {
      return renderPublicLanding(null);
    }

    if (error instanceof ServerApiError) {
      return (
        <PublicSiteShell
          publicName={publicName}
          logoLightUrl={branding.logoLightUrl}
          logoDarkUrl={branding.logoDarkUrl}
        >
          <div className="space-y-4">
            <h1>Welcome</h1>
            <p role="alert">Unable to load your dashboard. Request ID: {error.requestId}</p>
            <p className="mt-4">
              <a href="/login">Sign in</a>
            </p>
          </div>
        </PublicSiteShell>
      );
    }

    throw error;
  }
}

/** Skeleton matching the personalized island's shape while it streams in. */
function PersonalizedSectionFallback() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="h-28 animate-pulse rounded-2xl border border-border bg-muted" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-24 animate-pulse rounded-2xl border border-border bg-muted" />
        <div className="h-24 animate-pulse rounded-2xl border border-border bg-muted" />
      </div>
    </div>
  );
}
