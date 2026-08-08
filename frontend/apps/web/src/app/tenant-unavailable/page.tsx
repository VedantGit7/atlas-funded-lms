import { notFound } from "next/navigation";
import { TenantUnavailableScreen } from "../../components/patterns/errors/TenantUnavailableScreen";
import { loadPublicTenantBranding } from "@atlas/tenant-branding";
import { runTenantStateGate } from "@atlas/tenant-gate";

type TenantUnavailablePageProps = Readonly<{
  searchParams: Promise<{ reason?: string; next?: string }>;
}>;

function sanitizeRetryHref(value: string | undefined, reason: string | undefined): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }

  // Prefer returning to admin for transient misses — most of these happen when
  // an already-authenticated admin hits a brief host-resolution race.
  if (reason === "not_found" || reason === "transient_error") {
    return "/admin";
  }

  return "/";
}

export default async function TenantUnavailablePage({ searchParams }: TenantUnavailablePageProps) {
  const gate = await runTenantStateGate();

  if (gate.kind === "not_found") {
    notFound();
  }

  const params = await searchParams;

  if (gate.kind === "unavailable") {
    const branding = await loadPublicTenantBranding({
      tenantId: gate.tenant.tenantId,
      requestId: gate.requestId,
    });

    return (
      <TenantUnavailableScreen
        branding={branding}
        reason={gate.reason}
        requestId={gate.requestId}
      />
    );
  }

  const branding = await loadPublicTenantBranding({
    tenantId: gate.tenant.tenantId,
    requestId: gate.tenant.requestId,
  });

  return (
    <TenantUnavailableScreen
      branding={branding}
      reason="TRANSIENT"
      requestId={gate.tenant.requestId}
      retryHref={sanitizeRetryHref(params.next, params.reason)}
    />
  );
}
