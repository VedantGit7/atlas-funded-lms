import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * QA review 2, C9: creating a batch, poll, live session or custom field always
 * failed with 400 "Invalid request". Each route passed its body schema as
 * `input:`, which `createTenantRoute` reads from the URL query, so the JSON
 * the admin screen sent was never seen. These tests call the real route
 * handlers with a JSON body (the way the screens do) and check the service
 * receives it. `pnpm check:write-route-body` guards the rest of the API.
 */

const tenantA = { tenantId: "018f0000-0000-7000-8000-000000000001" };
const adminMembershipId = "018f0000-0000-7000-8000-000000000010";
const createdId = "018f0000-0000-7000-8000-000000000020";
const createdAt = "2026-11-21T10:00:00.000Z";

const {
  mockResolveTenant,
  mockRequireSessionUser,
  mockResolveSessionPrincipal,
  mockRequireActiveMembership,
  mockCan,
  mockEnforceEntitlement,
  mockCreateBatch,
  mockCreatePoll,
  mockCreateLiveSession,
  mockCreateCustomFieldDefinition,
  mockWithGlobalDb,
  mockWithTenantTx,
} = vi.hoisted(() => ({
  mockResolveTenant: vi.fn(),
  mockRequireSessionUser: vi.fn(),
  mockResolveSessionPrincipal: vi.fn(),
  mockRequireActiveMembership: vi.fn(),
  mockCan: vi.fn(),
  mockEnforceEntitlement: vi.fn(),
  mockCreateBatch: vi.fn(),
  mockCreatePoll: vi.fn(),
  mockCreateLiveSession: vi.fn(),
  mockCreateCustomFieldDefinition: vi.fn(),
  mockWithGlobalDb: vi.fn((fn: (db: unknown) => unknown) => fn({ $queryRaw: vi.fn() })),
  mockWithTenantTx: vi.fn((_ctx: unknown, fn: (tx: unknown) => unknown) =>
    fn({
      // A successful idempotency claim, and the audit marker the (mocked)
      // services would have written; everything else returns no rows.
      $queryRaw: vi.fn((query: TemplateStringsArray) =>
        Promise.resolve(
          /INSERT INTO idempotency_records/i.test(query.join(" "))
            ? [{ id: "018f0000-0000-7000-8000-000000000030" }]
            : query.join(" ").includes("atlas.audit_written")
              ? [{ written: "on" }]
              : [],
        ),
      ),
      $queryRawUnsafe: vi.fn().mockResolvedValue([]),
      $executeRaw: vi.fn().mockResolvedValue(0),
      $executeRawUnsafe: vi.fn().mockResolvedValue(0),
    }),
  ),
}));

vi.mock("@atlas/tenancy", () => ({
  resolveTenantFromRecentLookup: () => null,
  resolveTenantFromRequest: (...args: unknown[]) => mockResolveTenant(...args),
}));

vi.mock("@atlas/api/session-user", () => ({
  requireSessionUser: (...args: unknown[]) => mockRequireSessionUser(...args),
  resolveSessionPrincipal: (...args: unknown[]) => mockResolveSessionPrincipal(...args),
}));

vi.mock("@atlas/membership", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    requireActiveMembership: (...args: unknown[]) => mockRequireActiveMembership(...args),
  };
});

vi.mock("@atlas/db/global-db", () => ({
  withGlobalDb: (fn: (db: unknown) => unknown) => mockWithGlobalDb(fn),
}));

vi.mock("@atlas/db/with-tenant-tx", () => ({
  withTenantTx: (ctx: unknown, fn: (tx: unknown) => unknown) => mockWithTenantTx(ctx, fn),
}));

vi.mock("@atlas/authorization", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    can: (...args: unknown[]) => mockCan(...args),
    enforceEntitlement: (...args: unknown[]) => mockEnforceEntitlement(...args),
  };
});

vi.mock("@atlas/domain/batches/batches.service", () => ({
  createBatch: (...args: unknown[]) => mockCreateBatch(...args),
  listBatches: vi.fn(),
}));

vi.mock("@atlas/domain/polls/polls.service", () => ({
  createPoll: (...args: unknown[]) => mockCreatePoll(...args),
  listPolls: vi.fn(),
}));

vi.mock("@atlas/domain/live/live.service", () => ({
  createLiveSession: (...args: unknown[]) => mockCreateLiveSession(...args),
  listLiveSessions: vi.fn(),
}));

vi.mock("@atlas/domain/custom-fields/custom-fields.service", () => ({
  createCustomFieldDefinition: (...args: unknown[]) => mockCreateCustomFieldDefinition(...args),
  listCustomFieldDefinitions: vi.fn(),
}));

import { POST as createBatchRoute } from "../../../backend/apps/api/src/app/api/v1/batches/route";
import { POST as createPollRoute } from "../../../backend/apps/api/src/app/api/v1/polls/route";
import { POST as createLiveSessionRoute } from "../../../backend/apps/api/src/app/api/v1/live/sessions/route";
import { POST as createCustomFieldRoute } from "../../../backend/apps/api/src/app/api/v1/custom-fields/definitions/route";

function postJson(path: string, body: unknown, query = ""): NextRequest {
  return new NextRequest(`http://tenant-a.localhost${path}${query}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": `write-route-body-${path}-${String(Math.random())}`,
    },
    body: JSON.stringify(body),
  });
}

/** The parsed input the route handed to the service (third argument). */
function inputOf(mock: ReturnType<typeof vi.fn>): unknown {
  return mock.mock.calls[0]?.[2];
}

describe("write routes read their data from the request body (QA review 2, C9)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveTenant.mockResolvedValue(tenantA);
    mockRequireSessionUser.mockResolvedValue({
      principalId: "principal-id",
      email: "admin@example.com",
      mfaEnabled: true,
      sessionAssuranceLevel: "aal2",
    });
    mockResolveSessionPrincipal.mockResolvedValue({ id: "principal-id" });
    mockRequireActiveMembership.mockResolvedValue({ membershipId: adminMembershipId });
    mockCan.mockResolvedValue({
      allowed: true,
      permission: "membership.update",
      reason: "ALLOWED",
    });
    mockEnforceEntitlement.mockResolvedValue(undefined);
  });

  it("creates a batch from the JSON body", async () => {
    mockCreateBatch.mockResolvedValue({
      data: {
        id: createdId,
        key: "morning-cohort",
        name: "Morning cohort",
        courseId: null,
        status: "ACTIVE",
        createdAt,
      },
    });

    const response = await createBatchRoute(
      postJson("/api/v1/batches", { key: "morning-cohort", name: "Morning cohort" }),
    );

    expect(response.status).toBe(200);
    expect(inputOf(mockCreateBatch)).toMatchObject({
      key: "morning-cohort",
      name: "Morning cohort",
    });
  });

  it("creates a poll from the JSON body", async () => {
    mockCreatePoll.mockResolvedValue({
      data: {
        id: createdId,
        title: "Best session time?",
        description: null,
        pollType: "multiple_choice",
        status: "ACTIVE",
        quizMode: false,
        allowMultipleAnswers: false,
        anonymousVote: false,
        resultVisibility: "after_vote",
        layout: "list",
        durationSeconds: null,
        liveSessionId: null,
        closesAt: null,
        options: [
          {
            id: "018f0000-0000-7000-8000-000000000021",
            label: "Morning",
            sortOrder: 0,
            isCorrect: false,
          },
        ],
        createdAt,
      },
    });

    const response = await createPollRoute(
      postJson("/api/v1/polls", {
        title: "Best session time?",
        options: [{ label: "Morning", sortOrder: 0 }],
      }),
    );

    expect(response.status).toBe(200);
    expect(inputOf(mockCreatePoll)).toMatchObject({
      title: "Best session time?",
      options: [{ label: "Morning", sortOrder: 0 }],
    });
  });

  it("creates a live session from the JSON body", async () => {
    mockCreateLiveSession.mockResolvedValue({
      data: {
        id: createdId,
        title: "Weekly Q&A",
        courseId: null,
        status: "scheduled",
        scheduledAt: "2026-12-01T12:00:00.000Z",
        startedAt: null,
        endedAt: null,
        metadataJson: null,
        createdAt,
      },
    });

    const response = await createLiveSessionRoute(
      postJson("/api/v1/live/sessions", {
        title: "Weekly Q&A",
        scheduledAt: "2026-12-01T12:00:00.000Z",
      }),
    );

    expect(response.status).toBe(200);
    expect(inputOf(mockCreateLiveSession)).toMatchObject({
      title: "Weekly Q&A",
      scheduledAt: "2026-12-01T12:00:00.000Z",
    });
  });

  it("creates a custom field from the JSON body", async () => {
    mockCreateCustomFieldDefinition.mockResolvedValue({
      data: {
        id: createdId,
        key: "trading_experience",
        label: "Trading experience",
        fieldType: "text",
        status: "ACTIVE",
        createdAt,
      },
    });

    const response = await createCustomFieldRoute(
      postJson("/api/v1/custom-fields/definitions", {
        key: "trading_experience",
        label: "Trading experience",
        fieldType: "text",
      }),
    );

    expect(response.status).toBe(200);
    expect(inputOf(mockCreateCustomFieldDefinition)).toMatchObject({
      key: "trading_experience",
      label: "Trading experience",
      fieldType: "text",
    });
  });

  it("still refuses an invalid body with a validation error", async () => {
    const response = await createBatchRoute(postJson("/api/v1/batches", { name: "" }));

    expect(response.status).toBe(400);
    expect(mockCreateBatch).not.toHaveBeenCalled();
  });

  it("refuses data smuggled in the URL query of a write", async () => {
    const response = await createBatchRoute(
      postJson("/api/v1/batches", { key: "a", name: "A" }, "?key=other"),
    );

    expect(response.status).toBe(400);
    expect(mockCreateBatch).not.toHaveBeenCalled();
  });
});
