import { notFound } from "next/navigation";
import { TenantUnavailable } from "../../../components/patterns/errors/TenantUnavailable";
import { loadPublicTenantBranding } from "../../../lib/server/public-tenant-branding";
import {
  runTenantStateGate,
  type TenantUnavailableReason,
} from "../../../lib/server/tenant-state-gate";

type TenantUnavailablePageProps = Readonly<{
  searchParams: Promise<{ reason?: string }>;
}>;

function parseReason(value: string | undefined): TenantUnavailableReason {
  if (
    value === "PROVISIONING" ||
    value === "SUSPENDED" ||
    value === "ARCHIVED" ||
    value === "DOMAIN_INACTIVE"
  ) {
    return value;
  }

  return "SUSPENDED";
}

export default async function TenantUnavailablePage({ searchParams }: TenantUnavailablePageProps) {
  const gate = await runTenantStateGate();

  if (gate.kind === "not_found") {
    notFound();
  }

  const params = await searchParams;
  const reason = gate.kind === "unavailable" ? gate.reason : parseReason(params.reason);
  const requestId = gate.kind === "unavailable" ? gate.requestId : gate.tenant.requestId;
  const tenantId = gate.tenant.tenantId;

  const branding = await loadPublicTenantBranding({ tenantId, requestId });

  return <TenantUnavailable branding={branding} reason={reason} requestId={requestId} />;
}
