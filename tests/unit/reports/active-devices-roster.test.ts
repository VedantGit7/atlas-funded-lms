import { describe, expect, it } from "vitest";
import {
  activeDevicesLearnerDetailResponseSchema,
  activeDevicesOverviewQuerySchema,
  activeDevicesOverviewResponseSchema,
  activeDevicesRosterQuerySchema,
  activeDevicesSessionDetailResponseSchema,
  deleteDeviceSessionsBodySchema,
  forceSignOutBodySchema,
} from "@atlas/domain/reports/active-devices-roster.dto";
import { validateSelectedColumns } from "@atlas/domain/reports/reports.allowed-columns";

describe("active devices roster dto", () => {
  it("parses roster query defaults", () => {
    const parsed = activeDevicesRosterQuerySchema.parse({
      email: "learner@example.com",
      page: "2",
    });
    expect(parsed.email).toBe("learner@example.com");
    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(50);
    expect(parsed.window).toBe("7d");
    expect(parsed.view).toBe("all");
  });

  it("parses overview query and response", () => {
    const query = activeDevicesOverviewQuerySchema.parse({ window: "24h" });
    expect(query.window).toBe("24h");

    const response = activeDevicesOverviewResponseSchema.parse({
      data: {
        summary: {
          activeDevicesCount: 10,
          previousPeriodCount: 8,
          changeCount: 2,
          learnersSignedIn: 5,
          overDeviceLimit: 1,
          flaggedSessions: 0,
          deviceLimitPolicy: 2,
          restrictionsEnabled: true,
          windowLabel: "24 Hours",
          windowFrom: "2026-08-03T00:00:00.000Z",
          windowTo: "2026-08-04T12:00:00.000Z",
        },
        trend: [{ date: "2026-08-03", activeDevices: 4, learnersSignedIn: 2 }],
      },
    });
    expect(response.data.summary.changeCount).toBe(2);
  });

  it("accepts delete and force sign-out bodies", () => {
    const deleted = deleteDeviceSessionsBodySchema.parse({
      sessionIds: ["11111111-1111-4111-8111-111111111111"],
    });
    expect(deleted.sessionIds).toHaveLength(1);

    const signOut = forceSignOutBodySchema.parse({
      membershipId: "22222222-2222-4222-8222-222222222222",
    });
    expect(signOut.membershipId).toBe("22222222-2222-4222-8222-222222222222");
  });

  it("parses enriched learner detail response", () => {
    const response = activeDevicesLearnerDetailResponseSchema.parse({
      data: {
        membershipId: "22222222-2222-4222-8222-222222222222",
        learnerName: "Priya",
        email: "priya@example.com",
        roleLabel: "Learner",
        summary: {
          activeDevices: 2,
          deviceLimit: 1,
          overLimit: true,
          firstSeenAt: "2026-03-14T10:00:00.000Z",
          lastActivityAt: "2026-03-14T14:00:00.000Z",
          distinctIpCount: 2,
          flagSummary: "Over device limit (2 of 1 allowed)",
        },
        policy: {
          deviceLimit: 1,
          restrictionsEnabled: true,
          source: "tenant_default",
          enforcementNote: "Enforcement: block new sign-ins when the limit is reached.",
        },
        riskSignals: [
          {
            key: "concurrent_locations",
            label: "Concurrent locations",
            status: "fail",
            detail: "2 distinct IPs",
          },
        ],
        recentActivity: [
          {
            id: "signin-1",
            at: "2026-03-14T14:00:00.000Z",
            kind: "signed_in",
            label: "Device signed in",
            detail: "IP: 1.1.1.1",
            severity: "danger",
          },
        ],
        devices: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            membershipId: "22222222-2222-4222-8222-222222222222",
            deviceFingerprint: "abc123",
            userAgent: "Mozilla/5.0 Chrome/141",
            ipAddress: "1.1.1.1",
            platform: "web",
            lastSeenAt: "2026-03-14T14:00:00.000Z",
            createdAt: "2026-03-14T10:00:00.000Z",
            shortId: "ABC1...",
            deviceLabel: "Device · Chrome",
            browserLabel: "Chrome",
            osLabel: "Web",
            status: "current",
            isCurrent: true,
          },
        ],
      },
    });
    expect(response.data.summary.overLimit).toBe(true);
    expect(response.data.devices[0]?.status).toBe("current");
  });

  it("parses session detail response", () => {
    const heatstrip = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      label: `${String(hour).padStart(2, "0")}:00 UTC`,
      level: hour === 14 ? ("current" as const) : ("none" as const),
      detail: "No presence recorded",
    }));

    const response = activeDevicesSessionDetailResponseSchema.parse({
      data: {
        membershipId: "22222222-2222-4222-8222-222222222222",
        learnerName: "Priya",
        email: "priya@example.com",
        roleLabel: "Learner",
        device: {
          id: "11111111-1111-4111-8111-111111111111",
          membershipId: "22222222-2222-4222-8222-222222222222",
          deviceFingerprint: "abc123",
          userAgent: "Mozilla/5.0 Chrome/141",
          ipAddress: "1.1.1.1",
          platform: "web",
          lastSeenAt: "2026-03-14T14:00:00.000Z",
          createdAt: "2026-03-14T10:00:00.000Z",
          shortId: "ABC1...",
          deviceLabel: "Device · Chrome",
          browserLabel: "Chrome",
          osLabel: "Web",
          status: "current",
          isCurrent: true,
          sessionAgeLabel: "4h",
          heartbeatStatus: "polling",
          fingerprintShareCount: 0,
        },
        network: {
          ipAddress: "1.1.1.1",
          geoAvailable: false,
          note: "IP geolocation and ISP lookup are not configured for this tenant.",
        },
        client: {
          platform: "web",
          osLabel: "Web",
          browserLabel: "Chrome",
          userAgent: "Mozilla/5.0 Chrome/141",
        },
        fingerprintPayload: { sessionId: "11111111-1111-4111-8111-111111111111" },
        heatstrip,
        recentActivity: [
          {
            id: "created-1",
            at: "2026-03-14T10:00:00.000Z",
            label: "Session created",
            detail: null,
            result: "ok",
            ipAddress: "1.1.1.1",
          },
        ],
        capabilities: {
          canRevoke: true,
          trustedDevicesSupported: false,
          requestTelemetrySupported: false,
        },
      },
    });
    expect(response.data.device.heartbeatStatus).toBe("polling");
    expect(response.data.heatstrip).toHaveLength(24);
  });

  it("allows enriched active-devices report columns", () => {
    const valid = validateSelectedColumns({
      datasetKey: "active-devices",
      columns: ["id", "learner_name", "platform", "created_at"],
    });
    expect(valid.ok).toBe(true);
  });
});
