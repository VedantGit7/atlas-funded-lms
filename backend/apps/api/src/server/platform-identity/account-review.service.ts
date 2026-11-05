import { auditWriter } from "@atlas/audit";
import { AtlasHttpError } from "@atlas/core/http/errors";
import type { PlatformTx } from "@atlas/db";
import type { AccountStatusRequest } from "./account-review.schemas";

/**
 * The platform plane's account review: find the account behind an email, and
 * disable or re-enable it. A disabled account gets no session and is refused
 * on its next request.
 */

type Ctx = { platformPrincipalId: string; requestId: string };

type AccountRow = {
  id: string;
  email: string;
  global_status: "active" | "unclaimed" | "disabled";
  created_at: Date;
  last_login_at: Date | null;
  active_membership_count: number;
  platform_role: string | null;
};

function notFound(message: string): AtlasHttpError {
  return new AtlasHttpError({ code: "PERMISSION_DENIED", status: 404, message });
}

function conflict(message: string): AtlasHttpError {
  return new AtlasHttpError({ code: "VALIDATION_ERROR", status: 409, message });
}

function mapAccount(row: AccountRow) {
  return {
    id: row.id,
    email: row.email,
    status: row.global_status,
    createdAt: row.created_at.toISOString(),
    lastLoginAt: row.last_login_at ? row.last_login_at.toISOString() : null,
    activeMembershipCount: row.active_membership_count,
    platformRole: row.platform_role,
  };
}

async function readAccount(
  tx: PlatformTx,
  where: { id: string } | { emailNormalized: string },
): Promise<AccountRow | null> {
  const id = "id" in where ? where.id : null;
  const emailNormalized = "emailNormalized" in where ? where.emailNormalized : null;
  const rows = await tx.$queryRaw<AccountRow[]>`
    SELECT ap.id::text,
           ap.email,
           ap.global_status,
           ap.created_at,
           ap.last_login_at,
           (SELECT count(*)::int FROM memberships m
             WHERE m.auth_principal_id = ap.id AND m.status = 'ACTIVE') AS active_membership_count,
           (SELECT po.role_key FROM platform_operators po
             WHERE po.auth_principal_id = ap.id AND po.revoked_at IS NULL LIMIT 1) AS platform_role
      FROM auth_principals ap
     WHERE (${id}::uuid IS NOT NULL AND ap.id = ${id}::uuid)
        OR (${emailNormalized}::text IS NOT NULL AND ap.email_normalized = ${emailNormalized}::text)
     LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function lookupPlatformAccount(tx: PlatformTx, emailNormalized: string) {
  const row = await readAccount(tx, { emailNormalized });
  return { data: row ? mapAccount(row) : null };
}

export async function setPlatformAccountStatus(
  tx: PlatformTx,
  ctx: Ctx,
  principalId: string,
  input: AccountStatusRequest,
) {
  if (principalId === ctx.platformPrincipalId) {
    throw conflict("You cannot change the status of your own account.");
  }

  const rows = await tx.$queryRaw<Array<{ global_status: AccountRow["global_status"] }>>`
    SELECT global_status FROM auth_principals WHERE id = ${principalId}::uuid FOR UPDATE
  `;
  const before = rows[0];
  if (!before) throw notFound("Account not found.");

  // Unclaimed placeholders are claimed by their owner's first confirmed
  // sign-in, not activated by an operator.
  if (before.global_status === "unclaimed") {
    throw conflict(
      "This account has not been claimed yet; there is no sign-in to enable or disable.",
    );
  }

  if (before.global_status !== input.status) {
    await tx.$executeRaw`
      UPDATE auth_principals
         SET global_status = ${input.status}, updated_at = now()
       WHERE id = ${principalId}::uuid
    `;

    await auditWriter.write(
      tx,
      {
        tenantId: null,
        actorMembershipId: null,
        platformPrincipalId: ctx.platformPrincipalId,
        requestId: ctx.requestId,
      },
      {
        action: "platform.identity.status_changed",
        target: { type: "auth_principal", id: principalId },
        before: { status: before.global_status },
        after: { status: input.status },
        reason: input.reason,
        metadata: {},
      },
    );
  }

  const account = await readAccount(tx, { id: principalId });
  if (!account) throw notFound("Account not found.");
  return { data: mapAccount(account) };
}
