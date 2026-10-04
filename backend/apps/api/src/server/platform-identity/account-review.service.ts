import { auditWriter } from "@atlas/audit";
import { inspectSupabaseUser } from "@atlas/auth/supabase-admin-users";
import { AtlasHttpError } from "@atlas/core/http/errors";
import type { PlatformTx } from "@atlas/db";
import type { AccountStatusRequest, RelinkDecisionRequest } from "./account-review.schemas";

/**
 * Audit H6: the platform plane's half of the identity rules.
 *
 * Sign-in never moves a principal to a different Supabase user. When a
 * confirmed email signs in under a new Supabase user, the attempt is recorded
 * as a relink request and an operator decides it here. Approval requires the
 * earlier Supabase user to be gone and the new one to hold the same confirmed
 * email; it never carries a platform grant across.
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
  pending_relink_request_count: number;
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
    pendingRelinkRequestCount: row.pending_relink_request_count,
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
             WHERE po.auth_principal_id = ap.id AND po.revoked_at IS NULL LIMIT 1) AS platform_role,
           (SELECT count(*)::int FROM auth_principal_relink_requests r
             WHERE r.auth_principal_id = ap.id AND r.status = 'pending') AS pending_relink_request_count
      FROM auth_principals ap
     WHERE (${id}::uuid IS NOT NULL AND ap.id = ${id}::uuid)
        OR (${emailNormalized}::text IS NOT NULL AND ap.email_normalized = ${emailNormalized}::text)
     LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function listPendingRelinkRequests(tx: PlatformTx) {
  const rows = await tx.$queryRaw<
    Array<{
      id: string;
      principal_id: string;
      email: string;
      account_status: "active" | "unclaimed" | "disabled";
      requested_at: Date;
      last_seen_at: Date;
      attempt_count: number;
      active_membership_count: number;
      platform_role: string | null;
    }>
  >`
    SELECT r.id::text,
           ap.id::text AS principal_id,
           ap.email,
           ap.global_status AS account_status,
           r.requested_at,
           r.last_seen_at,
           r.attempt_count,
           (SELECT count(*)::int FROM memberships m
             WHERE m.auth_principal_id = ap.id AND m.status = 'ACTIVE') AS active_membership_count,
           (SELECT po.role_key FROM platform_operators po
             WHERE po.auth_principal_id = ap.id AND po.revoked_at IS NULL LIMIT 1) AS platform_role
      FROM auth_principal_relink_requests r
      JOIN auth_principals ap ON ap.id = r.auth_principal_id
     WHERE r.status = 'pending'
     ORDER BY r.last_seen_at DESC
     LIMIT 200
  `;

  return {
    data: rows.map((row) => ({
      id: row.id,
      principalId: row.principal_id,
      email: row.email,
      accountStatus: row.account_status,
      requestedAt: row.requested_at.toISOString(),
      lastSeenAt: row.last_seen_at.toISOString(),
      attemptCount: row.attempt_count,
      activeMembershipCount: row.active_membership_count,
      platformRole: row.platform_role,
    })),
  };
}

type PendingRequestRow = {
  id: string;
  auth_principal_id: string;
  previous_supabase_user_id: string;
  requested_supabase_user_id: string;
  principal_supabase_user_id: string;
  principal_email_normalized: string;
};

async function lockPendingRequest(tx: PlatformTx, requestId: string): Promise<PendingRequestRow> {
  const rows = await tx.$queryRaw<PendingRequestRow[]>`
    SELECT r.id::text,
           r.auth_principal_id::text,
           r.previous_supabase_user_id::text,
           r.requested_supabase_user_id::text,
           ap.supabase_user_id::text AS principal_supabase_user_id,
           ap.email_normalized AS principal_email_normalized
      FROM auth_principal_relink_requests r
      JOIN auth_principals ap ON ap.id = r.auth_principal_id
     WHERE r.id = ${requestId}::uuid
       AND r.status = 'pending'
       FOR UPDATE OF r, ap
  `;
  const row = rows[0];
  if (!row) throw notFound("Relink request not found or already decided.");
  return row;
}

export async function approveRelinkRequest(
  tx: PlatformTx,
  ctx: Ctx,
  relinkRequestId: string,
  input: RelinkDecisionRequest,
) {
  const request = await lockPendingRequest(tx, relinkRequestId);

  // The principal moved after the request was recorded (another approval, or
  // the old sign-in came back): this request describes a state that is gone.
  if (request.principal_supabase_user_id !== request.previous_supabase_user_id) {
    throw conflict(
      "The account changed after this request was made. Ask the person to sign in again.",
    );
  }

  const [previous, requested] = await Promise.all([
    inspectSupabaseUser(request.previous_supabase_user_id),
    inspectSupabaseUser(request.requested_supabase_user_id),
  ]);

  if (previous.exists) {
    throw conflict(
      "The earlier sign-in still exists in Supabase Auth. Relinking is only allowed once it has been deleted.",
    );
  }
  if (!requested.exists) {
    throw conflict("The new sign-in no longer exists in Supabase Auth.");
  }
  if (
    !requested.emailConfirmed ||
    requested.email?.trim().toLowerCase() !== request.principal_email_normalized
  ) {
    throw conflict("The new sign-in does not hold this account's email as a confirmed address.");
  }

  await tx.$executeRaw`
    UPDATE auth_principals
       SET supabase_user_id = ${request.requested_supabase_user_id}::uuid,
           updated_at = now()
     WHERE id = ${request.auth_principal_id}::uuid
  `;

  // Never transferred: whoever needs platform access again gets a new grant
  // through the normal, recorded path.
  const revoked = await tx.$queryRaw<Array<{ id: string; role_key: string }>>`
    UPDATE platform_operators
       SET revoked_at = now(),
           revoked_by_principal_id = ${ctx.platformPrincipalId}::uuid,
           revoke_reason = ${`Account relinked to a new sign-in after review ${relinkRequestId}; re-grant explicitly if still required.`},
           updated_at = now()
     WHERE auth_principal_id = ${request.auth_principal_id}::uuid
       AND revoked_at IS NULL
     RETURNING id::text, role_key
  `;
  const revokedGrant = revoked[0] ?? null;

  await tx.$executeRaw`
    UPDATE auth_principal_relink_requests
       SET status = 'approved',
           decided_at = now(),
           decided_by_principal_id = ${ctx.platformPrincipalId}::uuid,
           decision_reason = ${input.reason},
           revoked_platform_grant_id = ${revokedGrant?.id ?? null}::uuid
     WHERE id = ${relinkRequestId}::uuid
  `;

  await tx.$executeRaw`
    UPDATE auth_principal_relink_requests
       SET status = 'superseded', decided_at = now()
     WHERE auth_principal_id = ${request.auth_principal_id}::uuid
       AND status = 'pending'
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
      action: "platform.identity.relink_approved",
      target: { type: "auth_principal", id: request.auth_principal_id },
      before: { supabaseUserId: request.previous_supabase_user_id },
      after: {
        supabaseUserId: request.requested_supabase_user_id,
        revokedPlatformRole: revokedGrant?.role_key ?? null,
      },
      reason: input.reason,
      metadata: { relinkRequestId },
    },
  );

  return {
    data: {
      id: relinkRequestId,
      status: "approved" as const,
      principalId: request.auth_principal_id,
      platformGrantRevoked: revokedGrant !== null,
    },
  };
}

export async function rejectRelinkRequest(
  tx: PlatformTx,
  ctx: Ctx,
  relinkRequestId: string,
  input: RelinkDecisionRequest,
) {
  const request = await lockPendingRequest(tx, relinkRequestId);

  await tx.$executeRaw`
    UPDATE auth_principal_relink_requests
       SET status = 'rejected',
           decided_at = now(),
           decided_by_principal_id = ${ctx.platformPrincipalId}::uuid,
           decision_reason = ${input.reason}
     WHERE id = ${relinkRequestId}::uuid
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
      action: "platform.identity.relink_rejected",
      target: { type: "auth_principal", id: request.auth_principal_id },
      before: null,
      after: null,
      reason: input.reason,
      metadata: { relinkRequestId },
    },
  );

  return {
    data: {
      id: relinkRequestId,
      status: "rejected" as const,
      principalId: request.auth_principal_id,
      platformGrantRevoked: false,
    },
  };
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
