import { describe, expect, it } from "vitest";
import { healthResponseSchema } from "@atlas/observability/health-schema";

describe("health schema", () => {
  it("validates safe health payload", () => {
    const parsed = healthResponseSchema.parse({
      ok: true,
      service: "atlas-lms",
      status: "healthy",
      requestId: "req_00000000-0000-4000-8000-000000000001",
      environment: "staging",
      release: "2025.06.22",
    });

    expect(parsed.service).toBe("atlas-lms");
  });
});
