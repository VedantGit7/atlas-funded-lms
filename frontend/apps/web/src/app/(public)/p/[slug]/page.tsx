import { notFound } from "next/navigation";
import { PublicLandingView } from "../../../../features/public/components/PublicLandingView";
import { publicLandingServerApi } from "../../../../modules/public/public-landing.server-api";
import { runTenantStateGate } from "@atlas/tenant-gate";
import { ServerApiError, serverApi } from "../../../../lib/server-api";

type PublicLandingSlugPageProps = Readonly<{
  params: Promise<{ slug: string }>;
}>;

const OPERATIONAL_ROLE_KEYS = ["owner", "admin", "instructor", "moderator"] as const;

async function resolveLandingAuthCta(): Promise<{ label: string; href: string } | null> {
  try {
    const me = await serverApi.get<{ data: { membership: { roleKeys?: string[] } } }>("/api/v1/me");
    const roleKeys = me.data.membership.roleKeys ?? [];
    const isOperational = roleKeys.some((key) =>
      OPERATIONAL_ROLE_KEYS.includes(key as (typeof OPERATIONAL_ROLE_KEYS)[number]),
    );
    if (isOperational) return { label: "Dashboard", href: "/admin" };
    return { label: "Dashboard", href: "/" };
  } catch (error) {
    if (error instanceof ServerApiError && error.status === 401) return null;
    return null;
  }
}

export default async function PublicLandingSlugPage({ params }: PublicLandingSlugPageProps) {
  const { slug } = await params;
  const gate = await runTenantStateGate();

  if (gate.kind !== "ok") {
    notFound();
  }

  try {
    const [landing, authCta] = await Promise.all([
      publicLandingServerApi.getLanding(slug),
      resolveLandingAuthCta(),
    ]);

    return (
      <PublicLandingView
        landing={landing.data}
        requestId={gate.tenant.requestId}
        authCta={authCta}
      />
    );
  } catch (error) {
    if (error instanceof ServerApiError && error.status === 404) {
      notFound();
    }

    throw error;
  }
}
