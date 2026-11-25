import type { PublicTenantBranding } from "./public-tenant-branding";
import { loadPublicTenantBranding } from "./public-tenant-branding";
import { runTenantStateGate } from "./tenant-state-gate";
import {
  loadStudioNavigationProjection,
  type StudioNavigationProjection,
} from "./studio-navigation-projection";
import { ServerApiError, serverApi } from "../server-api";
import { primaryRoleLabel } from "../../components/shells/shared/role-label";

export type StudioShellMemberProjection = {
  membershipId: string;
  displayName: string | null;
  /** Their most senior role, such as "Administrator" (shared/role-label.ts). */
  roleLabel?: string;
  avatarUrl: string | null;
};

export type StudioShellContext =
  | {
      kind: "ready";
      requestId: string;
      branding: PublicTenantBranding;
      member: StudioShellMemberProjection;
      mfaEnabled: boolean;
      navigation: StudioNavigationProjection;
    }
  | {
      kind: "membership_blocked";
      requestId: string;
      branding: PublicTenantBranding;
      reason: "unauthenticated" | "forbidden" | "suspended" | "invited";
      message: string;
    }
  | {
      kind: "tenant_unavailable";
      reason: string;
    };

export const STUDIO_NO_ACCESS_MESSAGE =
  "Studio is where instructors and academy staff build courses. If you need it, ask your academy's administrator to give you an instructor role.";

export async function loadStudioShellContext(): Promise<StudioShellContext> {
  const gate = await runTenantStateGate();

  if (gate.kind === "not_found") {
    return { kind: "tenant_unavailable", reason: "not_found" };
  }

  if (gate.kind === "unavailable") {
    return { kind: "tenant_unavailable", reason: gate.reason };
  }

  const branding = await loadPublicTenantBranding({
    tenantId: gate.tenant.tenantId,
    requestId: gate.tenant.requestId,
  });

  try {
    const [me, navigation] = await Promise.all([
      serverApi.get<{
        data: {
          membership: {
            id: string;
            status: string;
            studioAccess?: boolean;
            roleKeys?: string[];
          };
          profile: { displayName: string | null; avatarUrl: string | null } | null;
          identity: { mfaEnabled: boolean };
        };
      }>("/api/v1/me"),
      loadStudioNavigationProjection(),
    ]);

    // Studio is for people who build or grade content (QA review 1 C20, m44):
    // a learner used to get the whole Studio, and saving failed silently.
    if (me.data.membership.studioAccess === false) {
      return {
        kind: "membership_blocked",
        requestId: gate.tenant.requestId,
        branding,
        reason: "forbidden",
        message: STUDIO_NO_ACCESS_MESSAGE,
      };
    }

    return {
      kind: "ready",
      requestId: gate.tenant.requestId,
      branding,
      member: {
        membershipId: me.data.membership.id,
        displayName: me.data.profile?.displayName ?? null,
        avatarUrl: me.data.profile?.avatarUrl ?? null,
        roleLabel: primaryRoleLabel(me.data.membership.roleKeys),
      },
      mfaEnabled: me.data.identity.mfaEnabled,
      navigation,
    };
  } catch (error) {
    if (!(error instanceof ServerApiError)) {
      throw error;
    }

    if (error.status === 401) {
      return {
        kind: "membership_blocked",
        requestId: gate.tenant.requestId,
        branding,
        reason: "unauthenticated",
        message: "Sign in with an active membership to access instructor studio.",
      };
    }

    if (error.code === "MEMBERSHIP_SUSPENDED") {
      return {
        kind: "membership_blocked",
        requestId: gate.tenant.requestId,
        branding,
        reason: "suspended",
        message: "Your membership is suspended.",
      };
    }

    if (error.code === "MEMBERSHIP_PENDING" || error.code === "MEMBERSHIP_INVITED") {
      return {
        kind: "membership_blocked",
        requestId: gate.tenant.requestId,
        branding,
        reason: "invited",
        message: "Accept your invitation to access instructor studio.",
      };
    }

    return {
      kind: "membership_blocked",
      requestId: gate.tenant.requestId,
      branding,
      reason: "forbidden",
      message: STUDIO_NO_ACCESS_MESSAGE,
    };
  }
}
