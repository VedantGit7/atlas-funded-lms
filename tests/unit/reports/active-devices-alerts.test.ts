import { describe, expect, it } from "vitest";
import {
  activeDevicesAlertActionBodySchema,
  activeDevicesAlertDetailResponseSchema,
  activeDevicesAlertsListResponseSchema,
  activeDevicesAlertsQuerySchema,
} from "@atlas/domain/reports/active-devices-alerts.dto";

describe("active devices alerts dto", () => {
  it("parses alerts query defaults", () => {
    const parsed = activeDevicesAlertsQuerySchema.parse({});
    expect(parsed.status).toBe("open");
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(50);
  });

  it("parses alerts list response", () => {
    const response = activeDevicesAlertsListResponseSchema.parse({
      data: {
        items: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            alertKey: "abc",
            alertType: "concurrent_sessions",
            severity: "critical",
            status: "open",
            title: "Two active sessions across IPs",
            membershipId: "22222222-2222-4222-8222-222222222222",
            learnerName: "Priya",
            email: "priya@example.com",
            detectedAt: "2026-08-04T12:00:00.000Z",
            resolvedAt: null,
            evidenceSummary: ["1.1.1.1", "2.2.2.2"],
            sessionCount: 2,
          },
        ],
        summary: {
          openTotal: 1,
          byType: {
            concurrent_sessions: 1,
            device_limit_exceeded: 0,
            shared_fingerprint: 0,
          },
          resolvedCount: 0,
          dismissedCount: 0,
          unsupportedRules: [
            {
              key: "impossible_travel",
              label: "Impossible travel",
              reason: "Requires IP geolocation, which is not configured.",
            },
          ],
        },
        pageInfo: {
          page: 1,
          pageSize: 50,
          totalCount: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      },
    });
    expect(response.data.items[0]?.severity).toBe("critical");
  });

  it("parses alert detail and action bodies", () => {
    const detail = activeDevicesAlertDetailResponseSchema.parse({
      data: {
        id: "11111111-1111-4111-8111-111111111111",
        alertKey: "abc",
        alertType: "device_limit_exceeded",
        severity: "warn",
        status: "open",
        title: "Device limit exceeded",
        membershipId: "22222222-2222-4222-8222-222222222222",
        learnerName: "Priya",
        email: "priya@example.com",
        detectedAt: "2026-08-04T12:00:00.000Z",
        resolvedAt: null,
        ruleLabel: "Device limit exceeded",
        thresholdLabel: "Above tenant limit",
        evidence: { deviceCount: 4, deviceLimit: 2 },
        sessions: [],
        notes: [],
        capabilities: {
          canResolve: true,
          canDismiss: true,
          canRevokeSessions: false,
          geoAvailable: false,
        },
      },
    });
    expect(detail.data.alertType).toBe("device_limit_exceeded");

    const action = activeDevicesAlertActionBodySchema.parse({
      alertIds: ["11111111-1111-4111-8111-111111111111"],
    });
    expect(action.alertIds).toHaveLength(1);
  });
});
