import { createHash, randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";
import { AtlasHttpError } from "@atlas/core/http/errors";
import type { ServiceCtx } from "../shared/domain.types";
import { devicesRepository } from "../devices/devices.repository";
import { activeDevicesRosterRepository } from "./active-devices-roster.repository";
import {
  activeDevicesAlertActionBodySchema,
  activeDevicesAlertActionResponseSchema,
  activeDevicesAlertDetailResponseSchema,
  activeDevicesAlertNoteBodySchema,
  activeDevicesAlertNoteResponseSchema,
  activeDevicesAlertsListResponseSchema,
  activeDevicesAlertsQuerySchema,
} from "./active-devices-alerts.dto";
import {
  activeDevicesAlertsRepository,
  type DetectedAlertCandidate,
} from "./active-devices-alerts.repository";
import {
  activeDevicesPoliciesRepository,
  mapTenantDefaults,
} from "./active-devices-policies.repository";

function defined<T>(value: T, message = "Expected value to be defined"): NonNullable<T> {
  if (value == null) {
    throw new Error(message);
  }
  return value;
}

function parseUserAgent(userAgent: string | null, platform: string | null): string {
  const ua = (userAgent ?? "").toLowerCase();
  let browser = "Browser";
  if (ua.includes("edg/")) browser = "Edge";
  else if (ua.includes("chrome/") && !ua.includes("edg/")) browser = "Chrome";
  else if (ua.includes("safari/") && !ua.includes("chrome/")) browser = "Safari";
  else if (ua.includes("firefox/")) browser = "Firefox";

  let device = platform?.replace(/_/g, " ") ?? "Device";
  if (ua.includes("ipad")) device = "iPad";
  else if (ua.includes("iphone")) device = "iPhone";
  else if (ua.includes("android")) device = "Android";
  else if (ua.includes("mac")) device = "Mac";
  else if (ua.includes("windows")) device = "Windows PC";

  return `${device} · ${browser}`;
}

function shortId(value: string | null | undefined, fallback: string): string {
  const source = (value ?? fallback).replace(/[^a-zA-Z0-9]/g, "");
  return `${source.slice(0, 4).toUpperCase()}...`;
}

function hashKey(parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 32);
}

function parseSessionIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function parseNotes(value: unknown): Array<{
  id: string;
  body: string;
  createdAt: string;
  authorMembershipId: string | null;
  authorLabel: string | null;
}> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const row = item as Record<string, unknown>;
      if (typeof row["body"] !== "string" || typeof row["id"] !== "string") return null;
      return {
        id: row["id"],
        body: row["body"],
        createdAt:
          typeof row["createdAt"] === "string" ? row["createdAt"] : new Date().toISOString(),
        authorMembershipId:
          typeof row["authorMembershipId"] === "string" ? row["authorMembershipId"] : null,
        authorLabel: typeof row["authorLabel"] === "string" ? row["authorLabel"] : null,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}

function detectCandidates(
  sessions: Awaited<ReturnType<typeof activeDevicesAlertsRepository.listSessionsWithIdentity>>,
  deviceLimit: number,
  sharedFingerprintThreshold: number,
  sharedFingerprintAlertEnabled: boolean,
): DetectedAlertCandidate[] {
  const now = Date.now();
  const CONCURRENT_MS = 2 * 60 * 60 * 1000;
  const byMembership = new Map<string, typeof sessions>();
  for (const row of sessions) {
    const list = byMembership.get(row.membership_id) ?? [];
    list.push(row);
    byMembership.set(row.membership_id, list);
  }

  const fingerprintOwners = new Map<string, Set<string>>();
  for (const row of sessions) {
    if (!row.device_fingerprint) continue;
    const owners = fingerprintOwners.get(row.device_fingerprint) ?? new Set();
    owners.add(row.membership_id);
    fingerprintOwners.set(row.device_fingerprint, owners);
  }

  const candidates: DetectedAlertCandidate[] = [];

  for (const [membershipId, memberSessions] of byMembership) {
    if (memberSessions.length > deviceLimit) {
      const sessionIds = memberSessions.map((row) => row.id).sort();
      candidates.push({
        alertKey: hashKey(["device_limit", membershipId, String(memberSessions.length)]),
        membershipId,
        alertType: "device_limit_exceeded",
        severity: "warn",
        title: `Device limit exceeded (${String(memberSessions.length)} of ${String(deviceLimit)} allowed)`,
        evidence: {
          deviceCount: memberSessions.length,
          deviceLimit,
          ips: [
            ...new Set(
              memberSessions.map((row) => row.ip_address).filter((ip): ip is string => Boolean(ip)),
            ),
          ],
        },
        sessionIds,
        detectedAt: defined(memberSessions[0]).last_seen_at,
      });
    }

    const recent = memberSessions.filter(
      (row) => now - row.last_seen_at.getTime() <= CONCURRENT_MS,
    );
    const ips = [
      ...new Set(
        recent.map((row) => row.ip_address?.trim()).filter((ip): ip is string => Boolean(ip)),
      ),
    ];
    if (ips.length >= 2 && recent.length >= 2) {
      const sortedRecent = [...recent].sort(
        (a, b) => a.last_seen_at.getTime() - b.last_seen_at.getTime(),
      );
      const first = defined(sortedRecent[0]);
      const last = defined(sortedRecent[sortedRecent.length - 1]);
      const deltaMins = Math.max(
        1,
        Math.round((last.last_seen_at.getTime() - first.last_seen_at.getTime()) / 60_000),
      );
      const sessionIds = recent.map((row) => row.id).sort();
      candidates.push({
        alertKey: hashKey(["concurrent", membershipId, ...sessionIds]),
        membershipId,
        alertType: "concurrent_sessions",
        severity: "critical",
        title: `${String(recent.length)} active sessions across ${String(ips.length)} IPs within ${String(deltaMins)} minutes`,
        evidence: {
          ips,
          deltaMinutes: deltaMins,
          sessionCount: recent.length,
          windows: recent.map((row) => ({
            sessionId: row.id,
            ipAddress: row.ip_address,
            lastSeenAt: row.last_seen_at.toISOString(),
            deviceLabel: parseUserAgent(row.user_agent, row.platform),
          })),
        },
        sessionIds,
        detectedAt: last.last_seen_at,
      });
    }

    if (sharedFingerprintAlertEnabled) {
      for (const row of memberSessions) {
        if (!row.device_fingerprint) continue;
        const owners = fingerprintOwners.get(row.device_fingerprint);
        if (!owners || owners.size < sharedFingerprintThreshold) continue;
        const otherCount = owners.size - 1;
        candidates.push({
          alertKey: hashKey(["shared_fp", row.device_fingerprint, membershipId]),
          membershipId,
          alertType: "shared_fingerprint",
          severity: otherCount >= 2 ? "critical" : "warn",
          title: `Shared device fingerprint seen on ${String(otherCount)} other learner${otherCount === 1 ? "" : "s"}`,
          evidence: {
            fingerprint: row.device_fingerprint,
            otherLearnerCount: otherCount,
            threshold: sharedFingerprintThreshold,
            sessionId: row.id,
            ipAddress: row.ip_address,
          },
          sessionIds: [row.id],
          detectedAt: row.last_seen_at,
        });
      }
    }
  }

  return candidates;
}

async function refreshOpenAlerts(tx: TenantTx): Promise<void> {
  const [policy, sessions, security] = await Promise.all([
    activeDevicesRosterRepository.readDeviceRegistrationLimit(tx),
    activeDevicesAlertsRepository.listSessionsWithIdentity(tx),
    activeDevicesPoliciesRepository.readSecuritySection(tx),
  ]);
  const defaults = mapTenantDefaults(security);
  const candidates = detectCandidates(
    sessions,
    policy.registrationLimit,
    defaults.sharedFingerprintThreshold,
    defaults.sharedFingerprintAlertEnabled,
  );
  for (const candidate of candidates) {
    await activeDevicesAlertsRepository.upsertOpenAlert(tx, candidate);
  }
}

function evidenceSummary(alertType: string, evidence: Record<string, unknown>): string[] {
  if (alertType === "concurrent_sessions") {
    const ips = Array.isArray(evidence["ips"])
      ? evidence["ips"].filter((ip): ip is string => typeof ip === "string")
      : [];
    const delta =
      typeof evidence["deltaMinutes"] === "number"
        ? `Δ ${String(evidence["deltaMinutes"])} min`
        : null;
    return [...ips.map((ip) => ip), ...(delta ? [delta] : [])];
  }
  if (alertType === "device_limit_exceeded") {
    const count = evidence["deviceCount"];
    const limit = evidence["deviceLimit"];
    return [`${String(count)} devices`, `Limit ${String(limit)}`];
  }
  if (alertType === "shared_fingerprint") {
    const other = evidence["otherLearnerCount"];
    return [`Shared with ${String(other)} other learner(s)`];
  }
  return [];
}

function ruleMeta(alertType: string): { ruleLabel: string; thresholdLabel: string } {
  if (alertType === "concurrent_sessions") {
    return {
      ruleLabel: "Concurrent sessions",
      thresholdLabel: "2+ distinct IPs active within 2 hours",
    };
  }
  if (alertType === "device_limit_exceeded") {
    return {
      ruleLabel: "Device limit exceeded",
      thresholdLabel: "Active devices above tenant registration limit",
    };
  }
  return {
    ruleLabel: "Shared fingerprint",
    thresholdLabel: "Same fingerprint on 2+ learner accounts",
  };
}

export async function listActiveDevicesAlerts(tx: TenantTx, ctx: ServiceCtx, rawQuery: unknown) {
  const query = activeDevicesAlertsQuerySchema.parse(rawQuery);
  await refreshOpenAlerts(tx);

  const offset = (query.page - 1) * query.limit;
  const [rows, totalCount, byType, byStatus] = await Promise.all([
    activeDevicesAlertsRepository.listAlerts(tx, {
      status: query.status,
      type: query.type,
      limit: query.limit,
      offset,
    }),
    activeDevicesAlertsRepository.countAlerts(tx, {
      status: query.status,
      type: query.type,
    }),
    activeDevicesAlertsRepository.countByTypeOpen(tx),
    activeDevicesAlertsRepository.countByStatus(tx),
  ]);

  const identityCache = new Map<string, { learner_name: string | null; email: string | null }>();
  const items = [];
  for (const row of rows) {
    let identity = identityCache.get(row.membership_id);
    if (!identity) {
      identity = (await activeDevicesRosterRepository.findLearnerIdentity(
        tx,
        row.membership_id,
      )) ?? {
        learner_name: null,
        email: null,
      };
      identityCache.set(row.membership_id, identity);
    }
    const evidence =
      row.evidence_json &&
      typeof row.evidence_json === "object" &&
      !Array.isArray(row.evidence_json)
        ? (row.evidence_json as Record<string, unknown>)
        : {};
    items.push({
      id: row.id,
      alertKey: row.alert_key,
      alertType: row.alert_type as
        | "concurrent_sessions"
        | "device_limit_exceeded"
        | "shared_fingerprint",
      severity: row.severity as "critical" | "warn" | "info",
      status: row.status as "open" | "resolved" | "dismissed",
      title: row.title,
      membershipId: row.membership_id,
      learnerName: identity.learner_name,
      email: identity.email,
      detectedAt: row.detected_at.toISOString(),
      resolvedAt: row.resolved_at?.toISOString() ?? null,
      evidenceSummary: evidenceSummary(row.alert_type, evidence),
      sessionCount: parseSessionIds(row.session_ids).length,
    });
  }

  const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / query.limit);
  void ctx;

  return activeDevicesAlertsListResponseSchema.parse({
    data: {
      items,
      summary: {
        openTotal: byStatus["open"] ?? 0,
        byType: {
          concurrent_sessions: byType["concurrent_sessions"] ?? 0,
          device_limit_exceeded: byType["device_limit_exceeded"] ?? 0,
          shared_fingerprint: byType["shared_fingerprint"] ?? 0,
        },
        resolvedCount: byStatus["resolved"] ?? 0,
        dismissedCount: byStatus["dismissed"] ?? 0,
        unsupportedRules: [
          {
            key: "impossible_travel",
            label: "Impossible travel",
            reason: "Requires IP geolocation, which is not configured.",
          },
          {
            key: "new_country",
            label: "New country",
            reason: "Requires IP geolocation, which is not configured.",
          },
        ],
      },
      pageInfo: {
        page: query.page,
        pageSize: query.limit,
        totalCount,
        totalPages,
        hasNextPage: query.page < totalPages,
        hasPreviousPage: query.page > 1,
      },
    },
  });
}

export async function getActiveDevicesAlertDetail(tx: TenantTx, _ctx: ServiceCtx, alertId: string) {
  await refreshOpenAlerts(tx);
  const row = await activeDevicesAlertsRepository.findById(tx, alertId);
  if (!row) {
    throw new AtlasHttpError({
      code: "PERMISSION_DENIED",
      status: 404,
      message: "Alert not found.",
    });
  }

  const identity = await activeDevicesRosterRepository.findLearnerIdentity(tx, row.membership_id);
  const sessionIds = parseSessionIds(row.session_ids);
  const sessions = [];
  for (const sessionId of sessionIds.slice(0, 20)) {
    const session = await devicesRepository.findSessionById(tx, sessionId);
    if (!session) continue;
    sessions.push({
      id: session.id,
      deviceLabel: parseUserAgent(session.user_agent, session.platform),
      shortId: shortId(session.device_fingerprint, session.id),
      ipAddress: session.ip_address,
      platform: session.platform,
      lastSeenAt: session.last_seen_at.toISOString(),
      createdAt: session.created_at.toISOString(),
    });
  }

  const evidence =
    row.evidence_json && typeof row.evidence_json === "object" && !Array.isArray(row.evidence_json)
      ? (row.evidence_json as Record<string, unknown>)
      : {};
  const meta = ruleMeta(row.alert_type);

  return activeDevicesAlertDetailResponseSchema.parse({
    data: {
      id: row.id,
      alertKey: row.alert_key,
      alertType: row.alert_type,
      severity: row.severity,
      status: row.status,
      title: row.title,
      membershipId: row.membership_id,
      learnerName: identity?.learner_name ?? null,
      email: identity?.email ?? null,
      detectedAt: row.detected_at.toISOString(),
      resolvedAt: row.resolved_at?.toISOString() ?? null,
      ruleLabel: meta.ruleLabel,
      thresholdLabel: meta.thresholdLabel,
      evidence,
      sessions,
      notes: parseNotes(row.notes_json),
      capabilities: {
        canResolve: row.status === "open",
        canDismiss: row.status === "open",
        canRevokeSessions: sessionIds.length > 0,
        geoAvailable: false,
      },
    },
  });
}

export async function resolveActiveDevicesAlerts(tx: TenantTx, ctx: ServiceCtx, rawBody: unknown) {
  const body = activeDevicesAlertActionBodySchema.parse(rawBody);
  const updatedCount = await activeDevicesAlertsRepository.updateStatus(tx, {
    alertIds: body.alertIds,
    status: "resolved",
    actorMembershipId: ctx.actorMembershipId,
  });
  return activeDevicesAlertActionResponseSchema.parse({ data: { updatedCount } });
}

export async function dismissActiveDevicesAlerts(tx: TenantTx, ctx: ServiceCtx, rawBody: unknown) {
  const body = activeDevicesAlertActionBodySchema.parse(rawBody);
  const updatedCount = await activeDevicesAlertsRepository.updateStatus(tx, {
    alertIds: body.alertIds,
    status: "dismissed",
    actorMembershipId: ctx.actorMembershipId,
  });
  return activeDevicesAlertActionResponseSchema.parse({ data: { updatedCount } });
}

export async function addActiveDevicesAlertNote(
  tx: TenantTx,
  ctx: ServiceCtx,
  alertId: string,
  rawBody: unknown,
) {
  const body = activeDevicesAlertNoteBodySchema.parse(rawBody);
  const identity = await activeDevicesRosterRepository.findLearnerIdentity(
    tx,
    ctx.actorMembershipId,
  );
  const note = {
    id: randomUUID(),
    body: body.body,
    createdAt: new Date().toISOString(),
    authorMembershipId: ctx.actorMembershipId,
    authorLabel: identity?.learner_name ?? identity?.email ?? "Admin",
  };
  const updated = await activeDevicesAlertsRepository.appendNote(tx, { alertId, note });
  if (!updated) {
    throw new AtlasHttpError({
      code: "PERMISSION_DENIED",
      status: 404,
      message: "Alert not found.",
    });
  }
  return activeDevicesAlertNoteResponseSchema.parse({ data: note });
}
