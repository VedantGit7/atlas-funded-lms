import { ServerApiError, serverApi } from "../server-api";
import type { PublicTenantBranding } from "./public-tenant-branding";
import { loadPublicTenantBranding } from "./public-tenant-branding";
import { runTenantStateGate } from "./tenant-state-gate";

export type ReviewShellContext =
  | {
      kind: "ready";
      requestId: string;
      branding: PublicTenantBranding;
      pendingReviewCount: number | null;
    }
  | {
      kind: "tenant_unavailable";
      reason: string;
    };

async function probePendingReviewCount(): Promise<number | null> {
  try {
    const response = await serverApi.get<{ data: unknown[] }>(
      "/api/v1/workflows?status=pending&limit=25",
    );
    return response.data.length;
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return null;
    }
    return null;
  }
}

export async function loadReviewShellContext(): Promise<ReviewShellContext> {
  const gate = await runTenantStateGate();

  if (gate.kind === "not_found") {
    return { kind: "tenant_unavailable", reason: "not_found" };
  }

  if (gate.kind === "unavailable") {
    return { kind: "tenant_unavailable", reason: gate.reason };
  }

  const [branding, pendingReviewCount] = await Promise.all([
    loadPublicTenantBranding({
      tenantId: gate.tenant.tenantId,
      requestId: gate.tenant.requestId,
    }),
    probePendingReviewCount(),
  ]);

  return {
    kind: "ready",
    requestId: gate.tenant.requestId,
    branding,
    pendingReviewCount,
  };
}
