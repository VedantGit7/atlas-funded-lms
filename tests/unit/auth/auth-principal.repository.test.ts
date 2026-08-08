import { describe, expect, it, vi } from "vitest";
import { upsertAuthPrincipal } from "@atlas/auth";

describe("upsertAuthPrincipal", () => {
  it("updates an existing principal matched by email before inserting", async () => {
    const existingRow = {
      id: "018f0000-0000-7000-8000-000000000010",
      email: "user@example.com",
      email_normalized: "user@example.com",
      global_status: "active",
      mfa_enabled: false,
      last_login_at: null,
    };

    const db = {
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([existingRow])
        .mockResolvedValueOnce([]),
    };

    const principal = await upsertAuthPrincipal({
      db,
      supabaseUserId: "018f0000-0000-7000-8000-000000000099",
      email: "user@example.com",
      markLogin: true,
    });

    expect(principal).toMatchObject({
      id: existingRow.id,
      emailNormalized: "user@example.com",
    });
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it("inserts a new principal when no email or supabase match exists", async () => {
    const insertedRow = {
      id: "018f0000-0000-7000-8000-000000000011",
      email: "new@example.com",
      email_normalized: "new@example.com",
      global_status: "active",
      mfa_enabled: false,
      last_login_at: null,
    };

    const db = {
      $queryRaw: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([insertedRow]),
    };

    const principal = await upsertAuthPrincipal({
      db,
      supabaseUserId: "018f0000-0000-7000-8000-000000000001",
      email: "new@example.com",
    });

    expect(principal).toMatchObject({
      id: insertedRow.id,
      emailNormalized: "new@example.com",
    });
    expect(db.$queryRaw).toHaveBeenCalledTimes(2);
  });
});
