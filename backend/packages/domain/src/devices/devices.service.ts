import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "../shared/domain.types";
import {
  captureDeviceSessionBodySchema,
  captureDeviceSessionResponseSchema,
  deleteDeviceSessionsBodySchema,
  deleteDeviceSessionsResponseSchema,
  forceSignOutBodySchema,
  forceSignOutResponseSchema,
  listDeviceSessionsQuerySchema,
  listDeviceSessionsResponseSchema,
} from "./devices.dto";
import { deviceSessionNotFound } from "./devices.errors";
import { devicesRepository } from "./devices.repository";

function toDto(row: Awaited<ReturnType<typeof devicesRepository.upsertSession>>) {
  return {
    id: row.id,
    membershipId: row.membership_id,
    deviceFingerprint: row.device_fingerprint,
    userAgent: row.user_agent,
    ipAddress: row.ip_address,
    platform: row.platform,
    lastSeenAt: row.last_seen_at.toISOString(),
    createdAt: row.created_at.toISOString(),
  };
}

export async function captureDeviceSession(tx: TenantTx, ctx: ServiceCtx, rawBody: unknown) {
  const body = captureDeviceSessionBodySchema.parse(rawBody);
  const row = await devicesRepository.upsertSession(tx, {
    membershipId: ctx.actorMembershipId,
    deviceFingerprint: body.deviceFingerprint ?? null,
    userAgent: body.userAgent ?? null,
    ipAddress: body.ipAddress ?? null,
    platform: body.platform ?? null,
  });

  return captureDeviceSessionResponseSchema.parse({ data: toDto(row) });
}

export async function listDeviceSessions(tx: TenantTx, _ctx: ServiceCtx, rawQuery: unknown) {
  const query = listDeviceSessionsQuerySchema.parse(rawQuery);
  const rows = await devicesRepository.listSessions(tx, {
    limit: query.limit,
    ...(query.membershipId ? { membershipId: query.membershipId } : {}),
    ...(query.cursor ? { cursor: query.cursor } : {}),
  });

  const hasNextPage = rows.length > query.limit;
  const items = rows.slice(0, query.limit).map(toDto);

  return listDeviceSessionsResponseSchema.parse({
    data: {
      items,
      pageInfo: {
        nextCursor: hasNextPage ? (items.at(-1)?.id ?? null) : null,
        hasNextPage,
      },
    },
  });
}

export async function deleteDeviceSessions(tx: TenantTx, _ctx: ServiceCtx, rawBody: unknown) {
  const body = deleteDeviceSessionsBodySchema.parse(rawBody);
  const uniqueIds = [...new Set(body.sessionIds)];
  const deletedCount = await devicesRepository.deleteSessionsByIds(tx, uniqueIds);
  if (deletedCount === 0) {
    throw deviceSessionNotFound();
  }
  return deleteDeviceSessionsResponseSchema.parse({ data: { deletedCount } });
}

export async function forceSignOutLearner(tx: TenantTx, _ctx: ServiceCtx, rawBody: unknown) {
  const body = forceSignOutBodySchema.parse(rawBody);
  const deletedCount = await devicesRepository.deleteSessionsForMembership(tx, body.membershipId);
  return forceSignOutResponseSchema.parse({
    data: {
      membershipId: body.membershipId,
      deletedCount,
    },
  });
}