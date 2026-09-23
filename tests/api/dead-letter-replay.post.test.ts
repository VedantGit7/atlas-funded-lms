import { createPlatformIdempotencyStore } from "../helpers/platform-idempotency-tx";
const replayStore = createPlatformIdempotencyStore();
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { ATLAS_PLATFORM_REASON_HEADER } from "@atlas/core/http/headers";

const {
  mockRequirePlatformPrincipal,
  mockReplayDeadLetterEvent,
  mockWithGlobalDb,
  mockWithPlatformScope,
  mockAuditWriterWrite,
  mockOutboxPublish,
  mockReplayDeliveryJob,
  mockFindDeadLetterForReplay,
} = vi.hoisted(() => ({
  mockRequirePlatformPrincipal: vi.fn(),
  mockReplayDeadLetterEvent: vi.fn(),
  mockWithGlobalDb: vi.fn((fn: (db: unknown) => unknown) => fn({ $queryRaw: vi.fn() })),
  mockWithPlatformScope: vi.fn((_ctx: unknown, _reason: string, fn: (tx: unknown) => unknown) =>
    fn(replayStore.wrap({ $queryRaw: vi.fn() })),
  ),
  mockAuditWriterWrite: vi.fn(),
  mockOutboxPublish: vi.fn(),
  mockReplayDeliveryJob: vi.fn(),
  mockFindDeadLetterForReplay: vi.fn(),
}));

vi.mock("@atlas/auth/platform-auth", () => ({
  requirePlatformPrincipal: (...args: unknown[]) => mockRequirePlatformPrincipal(...args),
}));

vi.mock("@atlas/db/global-db", () => ({
  withGlobalDb: (fn: (db: unknown) => unknown) => mockWithGlobalDb(fn),
}));

vi.mock("@atlas/db", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    withPlatformScope: mockWithPlatformScope,
  };
});

vi.mock("@atlas/events", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    replayDeadLetterEvent: (...args: unknown[]) => mockReplayDeadLetterEvent(...args),
  };
});

vi.mock("@atlas/audit", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    auditWriter: {
      write: (...args: unknown[]) => mockAuditWriterWrite(...args),
    },
  };
});

vi.mock("@atlas/events/repositories/dead-letter.repository", () => ({
  findDeadLetterForReplay: (...args: unknown[]) => mockFindDeadLetterForReplay(...args),
}));

vi.mock("@atlas/events/services/outbox.service", () => ({
  outbox: {
    publish: (...args: unknown[]) => mockOutboxPublish(...args),
  },
}));

vi.mock("@atlas/events/repositories/outbox-job.repository", () => ({
  replayDeliveryJob: (...args: unknown[]) => mockReplayDeliveryJob(...args),
}));

import { POST } from "../../backend/apps/api/src/app/api/v1/internal/outbox/dead-letter/[id]/replay/route";
import { replayDeadLetterEvent } from "@atlas/events/services/dead-letter-replay.service";

const platformPrincipal = {
  platformPrincipalId: "018f0000-0000-7000-8000-000000000020",
  platformPermissions: ["platform.tenant.manage"],
};

const deadLetterId = "018f0000-0000-7000-8000-000000000030";
const replayedOutboxEventId = "018f0000-0000-7000-8000-000000000031";

function createRequest(headers: Record<string, string> = {}) {
  return new NextRequest(
    `https://platform.example.com/api/v1/internal/outbox/dead-letter/${deadLetterId}/replay`,
    {
      method: "POST",
      headers: {
        host: "platform.example.com",
        authorization: "Bearer platform-token",
        [ATLAS_PLATFORM_REASON_HEADER]: "Replaying failed delivery after fix",
        "idempotency-key": "replay-key-001",
        ...headers,
      },
    },
  );
}

describe("POST /api/v1/internal/outbox/dead-letter/[id]/replay", () => {
  beforeEach(() => {
    mockRequirePlatformPrincipal.mockReset();
    mockReplayDeadLetterEvent.mockReset();
    mockWithGlobalDb.mockClear();
    mockWithPlatformScope.mockClear();

    mockRequirePlatformPrincipal.mockResolvedValue(platformPrincipal);
    mockReplayDeadLetterEvent.mockResolvedValue({ replayedOutboxEventId });
  });

  it("lets a platform principal with platform.tenant.manage replay a dead-letter event", async () => {
    const response = await POST(createRequest(), {
      params: Promise.resolve({ id: deadLetterId }),
    });
    const body = (await response.json()) as {
      data: { replayedOutboxEventId: string };
    };

    expect(response.status).toBe(200);
    expect(body.data.replayedOutboxEventId).toBe(replayedOutboxEventId);
    expect(mockRequirePlatformPrincipal).toHaveBeenCalledWith(
      expect.objectContaining({
        requiredPermission: "platform.tenant.manage",
      }),
    );
    expect(mockReplayDeadLetterEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        platformPrincipalId: platformPrincipal.platformPrincipalId,
        idempotencyKey: "replay-key-001",
      }),
      { deadLetterId },
    );
  });

  it("denies requests missing an Idempotency-Key header", async () => {
    const response = await POST(createRequest({ "idempotency-key": "" }), {
      params: Promise.resolve({ id: deadLetterId }),
    });
    const body = (await response.json()) as {
      error: { code: string; message: string };
    };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(mockReplayDeadLetterEvent).not.toHaveBeenCalled();
  });

  it("denies requests missing a platform reason", async () => {
    const response = await POST(createRequest({ [ATLAS_PLATFORM_REASON_HEADER]: "" }), {
      params: Promise.resolve({ id: deadLetterId }),
    });
    const body = (await response.json()) as {
      error: { code: string; message: string };
    };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(mockReplayDeadLetterEvent).not.toHaveBeenCalled();
  });

  it("denies callers without platform.tenant.manage", async () => {
    mockRequirePlatformPrincipal.mockRejectedValue(
      new AtlasHttpError({
        code: "PERMISSION_DENIED",
        status: 403,
        message: "Platform access denied.",
      }),
    );

    const response = await POST(createRequest(), {
      params: Promise.resolve({ id: deadLetterId }),
    });
    const body = (await response.json()) as {
      error: { code: string; message: string };
    };

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("PERMISSION_DENIED");
    expect(mockReplayDeadLetterEvent).not.toHaveBeenCalled();
  });
});

describe("replayDeadLetterEvent", () => {
  const deadLetterRow = {
    id: deadLetterId,
    outbox_event_id: "018f0000-0000-7000-8000-000000000040",
    tenant_id: "tenant-a-id",
    destination_key: "analytics.projection",
    event_type: "course.published",
    payload_json: { courseId: "018f0000-0000-7000-8000-000000000041" },
    request_id: "original-request-id",
  };

  beforeEach(() => {
    mockAuditWriterWrite.mockReset();
    mockOutboxPublish.mockReset();
    mockReplayDeliveryJob.mockReset();
    mockReplayDeliveryJob.mockResolvedValue(undefined);
    mockFindDeadLetterForReplay.mockReset();

    mockFindDeadLetterForReplay.mockResolvedValue(deadLetterRow);
    mockAuditWriterWrite.mockResolvedValue(undefined);
    mockOutboxPublish.mockResolvedValue({ id: replayedOutboxEventId });
  });

  it("writes an audit entry when replaying", async () => {
    await replayDeadLetterEvent(
      { $queryRaw: vi.fn() },
      {
        platformPrincipalId: platformPrincipal.platformPrincipalId,
        requestId: "replay-request-id",
        reason: "Replaying failed delivery after fix",
        idempotencyKey: "replay-key-001",
      },
      { deadLetterId },
    );

    expect(mockAuditWriterWrite).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tenantId: deadLetterRow.tenant_id,
        platformPrincipalId: platformPrincipal.platformPrincipalId,
      }),
      expect.objectContaining({
        action: "outbox.dead_letter.replayed",
        target: { type: "dead_letter_event", id: deadLetterId },
      }),
    );
  });

  it("requeues only the original destination without republishing the event", async () => {
    const result = await replayDeadLetterEvent(
      { $queryRaw: vi.fn() },
      {
        platformPrincipalId: platformPrincipal.platformPrincipalId,
        requestId: "replay-request-id",
        reason: "Replaying failed delivery after fix",
        idempotencyKey: "replay-key-001",
      },
      { deadLetterId },
    );

    expect(mockOutboxPublish).not.toHaveBeenCalled();
    expect(mockReplayDeliveryJob).toHaveBeenCalledWith(expect.anything(), {
      deadLetterId,
      outboxEventId: deadLetterRow.outbox_event_id,
      destinationKey: deadLetterRow.destination_key,
    });
    expect(result.replayedOutboxEventId).toBe(deadLetterRow.outbox_event_id);
  });

  it("does not update or delete the original dead-letter row", async () => {
    const tx = { $queryRaw: vi.fn() };
    await replayDeadLetterEvent(
      tx,
      {
        platformPrincipalId: platformPrincipal.platformPrincipalId,
        requestId: "replay-request-id",
        reason: "Replaying failed delivery after fix",
        idempotencyKey: "replay-key-001",
      },
      { deadLetterId },
    );

    expect(mockFindDeadLetterForReplay).toHaveBeenCalledWith(tx, deadLetterId);
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });
});
