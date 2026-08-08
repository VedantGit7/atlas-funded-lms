import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "../shared/domain.types";
import { devicesRepository } from "../devices/devices.repository";
import {
  activeDevicesLearnerDetailResponseSchema,
  activeDevicesOverviewResponseSchema,
  activeDevicesRosterListResponseSchema,
  activeDevicesRosterQuerySchema,
  activeDevicesSessionDetailResponseSchema,
  type ActiveDevicesOverviewQuery,
  type ActiveDevicesRosterQuery,
} from "./active-devices-roster.dto";
import {
  activeDevicesRosterRepository,
  resolveActiveDevicesWindow,
} from "./active-devices-roster.repository";
import { AtlasHttpError } from "@atlas/core/http/errors";

function defined<T>(value: T, message = "Expected value to be defined"): NonNullable<T> {
  if (value == null) {
    throw new Error(message);
  }
  return value;
}

function toFilter(
  query: Pick<ActiveDevicesRosterQuery, "email" | "platform" | "window" | "view">,
  registrationLimit: number,
) {
  const { windowFrom } = resolveActiveDevicesWindow(query.window);
  return {
    ...(query.email ? { email: query.email } : {}),
    ...(query.platform ? { platform: query.platform } : {}),
    windowFrom: windowFrom?.toISOString() ?? null,
    overLimitOnly: query.view === "attention",
    registrationLimit,
  };
}

export async function getActiveDevicesOverview(
  tx: TenantTx,
  _ctx: ServiceCtx,
  query: ActiveDevicesOverviewQuery,
) {
  const policy = await activeDevicesRosterRepository.readDeviceRegistrationLimit(tx);
  const resolved = resolveActiveDevicesWindow(query.window);
  const filter = {
    ...(query.email ? { email: query.email } : {}),
    ...(query.platform ? { platform: query.platform } : {}),
  };
  const windowFromIso = resolved.windowFrom?.toISOString() ?? null;
  const windowToIso = resolved.windowTo.toISOString();

  const [activeDevicesCount, learnersSignedIn, overDeviceLimit, previousPeriodCount, trend] =
    await Promise.all([
      activeDevicesRosterRepository.countSessionsInWindow(tx, filter, windowFromIso, windowToIso),
      activeDevicesRosterRepository.countDistinctLearnersInWindow(
        tx,
        filter,
        windowFromIso,
        windowToIso,
      ),
      activeDevicesRosterRepository.countLearnersOverLimit(
        tx,
        filter,
        policy.registrationLimit,
        windowFromIso,
      ),
      resolved.previousFrom && resolved.previousTo
        ? activeDevicesRosterRepository.countSessionsInWindow(
            tx,
            filter,
            resolved.previousFrom.toISOString(),
            resolved.previousTo.toISOString(),
          )
        : Promise.resolve(0),
      resolved.windowFrom
        ? activeDevicesRosterRepository.getDailyTrend(
            tx,
            filter,
            resolved.windowFrom.toISOString(),
            windowToIso,
          )
        : Promise.resolve([]),
    ]);

  return activeDevicesOverviewResponseSchema.parse({
    data: {
      summary: {
        activeDevicesCount,
        previousPeriodCount,
        changeCount: activeDevicesCount - previousPeriodCount,
        learnersSignedIn,
        overDeviceLimit,
        flaggedSessions: 0,
        deviceLimitPolicy: policy.registrationLimit,
        restrictionsEnabled: policy.restrictionsEnabled,
        windowLabel: resolved.windowLabel,
        windowFrom: windowFromIso,
        windowTo: windowToIso,
      },
      trend,
    },
  });
}

export async function listActiveDevicesRoster(
  tx: TenantTx,
  _ctx: ServiceCtx,
  query: ActiveDevicesRosterQuery,
) {
  const policy = await activeDevicesRosterRepository.readDeviceRegistrationLimit(tx);
  const filter = toFilter(query, policy.registrationLimit);

  // Suspicious activity has no data model yet - return empty roster.
  if (query.view === "suspicious") {
    return activeDevicesRosterListResponseSchema.parse({
      data: {
        items: [],
        pageInfo: {
          page: query.page,
          pageSize: query.limit,
          totalCount: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      },
    });
  }

  const [totalCount, rows] = await Promise.all([
    activeDevicesRosterRepository.countLearners(tx, filter),
    activeDevicesRosterRepository.listLearners(tx, query, filter),
  ]);

  const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / query.limit);

  return activeDevicesRosterListResponseSchema.parse({
    data: {
      items: rows.map((row) => ({
        membershipId: row.membership_id,
        learnerName: row.learner_name,
        email: row.email,
        deviceCount: row.device_count,
        lastSeenAt: row.last_seen_at?.toISOString() ?? null,
        platforms: row.platforms ?? [],
        ipAddresses: row.ip_addresses ?? [],
        status:
          row.device_count > policy.registrationLimit
            ? ("over_limit" as const)
            : ("active" as const),
      })),
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

function shortDeviceId(value: string | null | undefined, fallbackId: string): string {
  const source = (value ?? fallbackId).replace(/[^a-zA-Z0-9]/g, "");
  if (source.length <= 4) return `${source.toUpperCase()}...`;
  return `${source.slice(0, 4).toUpperCase()}...`;
}

function parseUserAgent(
  userAgent: string | null,
  platform: string | null,
): {
  deviceLabel: string;
  browserLabel: string | null;
  osLabel: string | null;
} {
  const ua = userAgent ?? "";
  const lower = ua.toLowerCase();
  let browserLabel: string | null = null;
  if (lower.includes("edg/")) browserLabel = "Edge";
  else if (lower.includes("chrome/") && !lower.includes("edg/")) browserLabel = "Chrome";
  else if (lower.includes("safari/") && !lower.includes("chrome/")) browserLabel = "Safari";
  else if (lower.includes("firefox/")) browserLabel = "Firefox";

  let osLabel: string | null = platform ? platform.replace(/_/g, " ") : null;
  if (!osLabel) {
    if (lower.includes("iphone") || lower.includes("ipad") || lower.includes("ios"))
      osLabel = "iOS";
    else if (lower.includes("android")) osLabel = "Android";
    else if (lower.includes("mac os") || lower.includes("macintosh")) osLabel = "macOS";
    else if (lower.includes("windows")) osLabel = "Windows";
    else if (lower.includes("linux")) osLabel = "Linux";
  } else {
    osLabel = osLabel.replace(/\b\w/g, (char) => char.toUpperCase());
  }

  let deviceName = "Device";
  if (lower.includes("ipad")) deviceName = "iPad";
  else if (lower.includes("iphone")) deviceName = "iPhone";
  else if (lower.includes("android") && lower.includes("mobile")) deviceName = "Android phone";
  else if (lower.includes("android")) deviceName = "Android device";
  else if (osLabel === "macOS") deviceName = "Mac";
  else if (osLabel === "Windows") deviceName = "Windows PC";
  else if (osLabel === "Linux") deviceName = "Linux desktop";
  else if (platform) deviceName = platform.replace(/_/g, " ");

  const deviceLabel = browserLabel ? `${deviceName} · ${browserLabel}` : deviceName;
  return { deviceLabel, browserLabel, osLabel };
}

function buildLearnerDeviceDetail(
  membershipId: string,
  sessions: Array<{
    id: string;
    membership_id: string;
    device_fingerprint: string | null;
    user_agent: string | null;
    ip_address: string | null;
    platform: string | null;
    last_seen_at: Date;
    created_at: Date;
  }>,
  deviceLimit: number,
  restrictionsEnabled: boolean,
) {
  const now = Date.now();
  const ACTIVE_MS = 24 * 60 * 60 * 1000;
  const CONCURRENT_MS = 2 * 60 * 60 * 1000;

  const sorted = [...sessions].sort((a, b) => b.last_seen_at.getTime() - a.last_seen_at.getTime());
  const recentConcurrent = sorted.filter(
    (row) => now - row.last_seen_at.getTime() <= CONCURRENT_MS,
  );
  const concurrentIps = new Set(
    recentConcurrent.map((row) => row.ip_address?.trim()).filter((ip): ip is string => Boolean(ip)),
  );
  const concurrentLocationFail = concurrentIps.size >= 2;

  const flaggedIds = new Set<string>();
  if (concurrentLocationFail) {
    for (const row of recentConcurrent) {
      if (row.ip_address) flaggedIds.add(row.id);
    }
  }

  const devices = sorted.map((row, index) => {
    const ageMs = now - row.last_seen_at.getTime();
    let status: "current" | "active" | "idle" | "flagged" = "idle";
    if (flaggedIds.has(row.id)) status = "flagged";
    else if (index === 0) status = "current";
    else if (ageMs <= ACTIVE_MS) status = "active";

    const parsed = parseUserAgent(row.user_agent, row.platform);
    return {
      id: row.id,
      membershipId: row.membership_id,
      deviceFingerprint: row.device_fingerprint,
      userAgent: row.user_agent,
      ipAddress: row.ip_address,
      platform: row.platform,
      lastSeenAt: row.last_seen_at.toISOString(),
      createdAt: row.created_at.toISOString(),
      shortId: shortDeviceId(row.device_fingerprint, row.id),
      deviceLabel: parsed.deviceLabel,
      browserLabel: parsed.browserLabel,
      osLabel: parsed.osLabel,
      status,
      isCurrent: index === 0,
    };
  });

  const distinctIps = [
    ...new Set(
      sorted.map((row) => row.ip_address?.trim()).filter((ip): ip is string => Boolean(ip)),
    ),
  ];
  const firstSeenAt =
    sorted.length > 0
      ? defined(
          [...sorted].sort((a, b) => a.created_at.getTime() - b.created_at.getTime())[0],
        ).created_at.toISOString()
      : null;
  const lastActivityAt = sorted[0]?.last_seen_at.toISOString() ?? null;
  const overLimit = sorted.length > deviceLimit;

  let flagSummary: string | null = null;
  if (concurrentLocationFail) {
    flagSummary = `1 - concurrent sessions across ${String(concurrentIps.size)} IPs`;
  } else if (overLimit) {
    flagSummary = `Over device limit (${String(sorted.length)} of ${String(deviceLimit)} allowed)`;
  }

  const recognisedCount = sorted.filter((row) => Boolean(row.device_fingerprint)).length;
  const riskSignals = [
    {
      key: "concurrent_locations" as const,
      label: "Concurrent locations",
      status: concurrentLocationFail ? ("fail" as const) : ("pass" as const),
      detail: concurrentLocationFail
        ? `${String(concurrentIps.size)} distinct IPs active in the last 2 hours`
        : null,
    },
    {
      key: "device_count" as const,
      label: "Device count",
      status: overLimit ? ("warn" as const) : ("pass" as const),
      detail: overLimit
        ? `${String(sorted.length)} devices vs ${String(deviceLimit)} allowed`
        : null,
    },
    {
      key: "recognised_devices" as const,
      label: "Recognised devices",
      status:
        sorted.length === 0 || recognisedCount === sorted.length
          ? ("pass" as const)
          : recognisedCount === 0
            ? ("warn" as const)
            : ("warn" as const),
      detail:
        sorted.length === 0
          ? null
          : `${String(recognisedCount)} of ${String(sorted.length)} have fingerprints`,
    },
    {
      key: "no_shared_ip" as const,
      label: "No shared IP",
      status: "pass" as const,
      detail: "Cross-learner IP sharing checks are not enabled yet",
    },
  ];

  const recentActivity: Array<{
    id: string;
    at: string;
    kind: "signed_in" | "last_seen" | "over_limit";
    label: string;
    detail: string | null;
    severity: "neutral" | "warning" | "danger";
  }> = [];

  if (overLimit) {
    recentActivity.push({
      id: `over-limit-${membershipId}`,
      at: lastActivityAt ?? new Date().toISOString(),
      kind: "over_limit",
      label: "Sign-in blocked risk (limit reached)",
      detail: `${String(sorted.length)} of ${String(deviceLimit)} devices allowed`,
      severity: "warning",
    });
  }

  for (const row of sorted.slice(0, 12)) {
    const parsed = parseUserAgent(row.user_agent, row.platform);
    const ipDetail = row.ip_address ? `IP: ${row.ip_address}` : null;
    recentActivity.push({
      id: `signin-${row.id}`,
      at: row.created_at.toISOString(),
      kind: "signed_in",
      label: `Device signed in (${parsed.deviceLabel})`,
      detail: ipDetail,
      severity: flaggedIds.has(row.id) ? "danger" : "neutral",
    });
    if (Math.abs(row.last_seen_at.getTime() - row.created_at.getTime()) > 60_000) {
      recentActivity.push({
        id: `seen-${row.id}`,
        at: row.last_seen_at.toISOString(),
        kind: "last_seen",
        label: `Session activity (${parsed.deviceLabel})`,
        detail: ipDetail,
        severity: "neutral",
      });
    }
  }

  recentActivity.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return {
    devices,
    summary: {
      activeDevices: sorted.length,
      deviceLimit,
      overLimit,
      firstSeenAt,
      lastActivityAt,
      distinctIpCount: distinctIps.length,
      flagSummary,
    },
    policy: {
      deviceLimit,
      restrictionsEnabled,
      source: "tenant_default" as const,
      enforcementNote: restrictionsEnabled
        ? "Enforcement: block new sign-ins when the limit is reached."
        : "Restrictions are off. Device counts are monitored only.",
    },
    riskSignals,
    recentActivity: recentActivity.slice(0, 12),
  };
}

export async function getActiveDevicesLearnerDetail(
  tx: TenantTx,
  _ctx: ServiceCtx,
  membershipId: string,
) {
  const identity = await activeDevicesRosterRepository.findLearnerIdentity(tx, membershipId);
  if (!identity) {
    throw new AtlasHttpError({
      code: "PERMISSION_DENIED",
      status: 404,
      message: "Learner not found.",
    });
  }

  const [policy, sessions] = await Promise.all([
    activeDevicesRosterRepository.readDeviceRegistrationLimit(tx),
    devicesRepository.listSessions(tx, {
      membershipId,
      limit: 100,
    }),
  ]);

  const enriched = buildLearnerDeviceDetail(
    membershipId,
    sessions.slice(0, 100),
    policy.registrationLimit,
    policy.restrictionsEnabled,
  );

  return activeDevicesLearnerDetailResponseSchema.parse({
    data: {
      membershipId,
      learnerName: identity.learner_name,
      email: identity.email,
      roleLabel: "Learner",
      ...enriched,
    },
  });
}

function formatSessionAge(createdAt: Date, nowMs: number): string {
  const diffMs = Math.max(0, nowMs - createdAt.getTime());
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${String(mins)}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) {
    const remMins = mins % 60;
    return remMins > 0 ? `${String(hours)}h ${String(remMins)}m` : `${String(hours)}h`;
  }
  const days = Math.floor(hours / 24);
  return `${String(days)}d`;
}

function buildPresenceHeatstrip(createdAt: Date, lastSeenAt: Date, now: Date) {
  const hours: Array<{
    hour: number;
    label: string;
    level: "none" | "low" | "mid" | "high" | "current";
    detail: string;
  }> = [];
  const dayStart = new Date(now);
  dayStart.setUTCMinutes(0, 0, 0);
  dayStart.setUTCHours(now.getUTCHours() - 23);

  const createdMs = createdAt.getTime();
  const lastMs = lastSeenAt.getTime();
  const currentHour = now.getUTCHours();

  for (let i = 0; i < 24; i += 1) {
    const slot = new Date(dayStart.getTime() + i * 60 * 60 * 1000);
    const hour = slot.getUTCHours();
    const slotStart = slot.getTime();
    const slotEnd = slotStart + 60 * 60 * 1000;
    const overlaps = createdMs < slotEnd && lastMs >= slotStart;
    const isCurrent = hour === currentHour && lastMs >= slotStart && lastMs < slotEnd;
    let level: "none" | "low" | "mid" | "high" | "current" = "none";
    if (isCurrent) level = "current";
    else if (overlaps) level = lastMs - createdMs > 6 * 60 * 60 * 1000 ? "mid" : "low";

    hours.push({
      hour,
      label: `${String(hour).padStart(2, "0")}:00 UTC`,
      level,
      detail: overlaps
        ? isCurrent
          ? "Last heartbeat in this hour"
          : "Session present in this hour"
        : "No presence recorded",
    });
  }
  return hours;
}

export async function getActiveDevicesSessionDetail(
  tx: TenantTx,
  _ctx: ServiceCtx,
  membershipId: string,
  deviceId: string,
) {
  const identity = await activeDevicesRosterRepository.findLearnerIdentity(tx, membershipId);
  if (!identity) {
    throw new AtlasHttpError({
      code: "PERMISSION_DENIED",
      status: 404,
      message: "Learner not found.",
    });
  }

  const session = await devicesRepository.findSessionById(tx, deviceId);
  if (!session || session.membership_id !== membershipId) {
    throw new AtlasHttpError({
      code: "PERMISSION_DENIED",
      status: 404,
      message: "Device session not found.",
    });
  }

  const [policy, siblingSessions] = await Promise.all([
    activeDevicesRosterRepository.readDeviceRegistrationLimit(tx),
    devicesRepository.listSessions(tx, { membershipId, limit: 100 }),
  ]);

  const enriched = buildLearnerDeviceDetail(
    membershipId,
    siblingSessions.slice(0, 100),
    policy.registrationLimit,
    policy.restrictionsEnabled,
  );
  const device = enriched.devices.find((row) => row.id === deviceId);
  if (!device) {
    throw new AtlasHttpError({
      code: "PERMISSION_DENIED",
      status: 404,
      message: "Device session not found.",
    });
  }

  const fingerprintShareCount = session.device_fingerprint
    ? await activeDevicesRosterRepository.countOtherMembershipsWithFingerprint(
        tx,
        session.device_fingerprint,
        membershipId,
      )
    : 0;

  const now = Date.now();
  const ageMs = now - session.last_seen_at.getTime();
  const heartbeatStatus =
    ageMs <= 15 * 60 * 1000 ? "polling" : ageMs <= 24 * 60 * 60 * 1000 ? "idle" : "stale";

  const recentActivity = [
    {
      id: `created-${session.id}`,
      at: session.created_at.toISOString(),
      label: "Session created",
      detail: device.deviceLabel,
      result: "ok" as const,
      ipAddress: session.ip_address,
    },
    {
      id: `seen-${session.id}`,
      at: session.last_seen_at.toISOString(),
      label: "Last heartbeat",
      detail:
        heartbeatStatus === "polling"
          ? "Status: polling"
          : heartbeatStatus === "idle"
            ? "Status: idle"
            : "Status: stale",
      result: device.status === "flagged" ? ("flagged" as const) : ("info" as const),
      ipAddress: session.ip_address,
    },
  ];
  if (device.status === "flagged") {
    recentActivity.push({
      id: `flag-${session.id}`,
      at: session.last_seen_at.toISOString(),
      label: "Flagged for concurrent IPs",
      detail: enriched.summary.flagSummary ?? "Flagged device",
      result: "flagged" as const,
      ipAddress: session.ip_address,
    });
  }
  recentActivity.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const fingerprintPayload = {
    sessionId: session.id,
    fingerprint: session.device_fingerprint,
    platform: session.platform,
    userAgent: session.user_agent,
    ipAddress: session.ip_address,
    createdAt: session.created_at.toISOString(),
    lastSeenAt: session.last_seen_at.toISOString(),
    status: device.status,
    fingerprintSharedWithOtherLearners: fingerprintShareCount,
    knownAnomalies: device.status === "flagged" ? ["concurrent_ip_activity"] : [],
  };

  return activeDevicesSessionDetailResponseSchema.parse({
    data: {
      membershipId,
      learnerName: identity.learner_name,
      email: identity.email,
      roleLabel: "Learner",
      device: {
        ...device,
        sessionAgeLabel: formatSessionAge(session.created_at, now),
        heartbeatStatus,
        fingerprintShareCount,
      },
      network: {
        ipAddress: session.ip_address,
        geoAvailable: false,
        note: "IP geolocation and ISP lookup are not configured for this tenant.",
      },
      client: {
        platform: session.platform,
        osLabel: device.osLabel,
        browserLabel: device.browserLabel,
        userAgent: session.user_agent,
      },
      fingerprintPayload,
      heatstrip: buildPresenceHeatstrip(session.created_at, session.last_seen_at, new Date(now)),
      recentActivity,
      capabilities: {
        canRevoke: true,
        trustedDevicesSupported: false,
        requestTelemetrySupported: false,
      },
    },
  });
}

export function parseActiveDevicesRosterQuery(rawQuery: unknown): ActiveDevicesRosterQuery {
  return activeDevicesRosterQuerySchema.parse(rawQuery);
}
