import type { MembershipStatus } from "@atlas/membership";
import {
  mapAuthServiceStatusToPublicStatus,
  resolveRedirectForAuthStatus,
  resolveRoleHomePath,
} from "./public-auth-ui.service";
import { PublicAuthResponseSchema } from "../schemas/public-auth";

type QueryableTx = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
};

type RoleRow = { key: string };

export async function readMembershipRoleKeys(args: {
  tx: QueryableTx;
  tenantId: string;
  membershipId: string;
}): Promise<string[]> {
  const rows = await args.tx.$queryRaw<RoleRow[]>`
    select r.key::text as key
    from user_roles ur
    join roles r on r.id = ur.role_id
    where ur.tenant_id = ${args.tenantId}::uuid
      and ur.membership_id = ${args.membershipId}::uuid
      and r.deleted_at is null
  `;

  return rows.map((row) => row.key);
}

export async function buildPublicAuthResponse(args: {
  tx: QueryableTx;
  tenantId: string;
  serviceStatus: "signed_in" | "verification_required";
  mfaEnabled: boolean;
  membership: { id: string; status: MembershipStatus } | null;
}) {
  const status = mapAuthServiceStatusToPublicStatus({
    serviceStatus: args.serviceStatus,
    mfaEnabled: args.mfaEnabled,
    membershipStatus: args.membership?.status ?? null,
  });

  let roleHome: string | null = null;

  if (status === "AUTHENTICATED" && args.membership) {
    const roleKeys = await readMembershipRoleKeys({
      tx: args.tx,
      tenantId: args.tenantId,
      membershipId: args.membership.id,
    });
    roleHome = resolveRoleHomePath(roleKeys);
  }

  return PublicAuthResponseSchema.parse({
    data: {
      status,
      redirectTo: resolveRedirectForAuthStatus(status, roleHome),
    },
  });
}
