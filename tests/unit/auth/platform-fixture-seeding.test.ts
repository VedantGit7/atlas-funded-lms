import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  history: [] as { role_key: string; revoked_at: string | null }[],
  query: vi.fn(),
  connect: vi.fn(),
  end: vi.fn(),
}));
vi.mock("pg", () => ({
  default: {
    Client: class {
      connect = fixture.connect;
      end = fixture.end;
      query = fixture.query;
    },
  },
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      admin: {
        createUser: async () => ({ data: { user: { id: "auth-user" } }, error: null }),
        mfa: { listFactors: async () => ({ data: { factors: [] }, error: null }) },
      },
      signInWithPassword: async () => ({ error: null }),
      signOut: async () => ({}),
      mfa: {
        enroll: async () => ({
          data: { id: "factor", totp: { secret: "GEZDGNBVGY3TQOJQ" } },
          error: null,
        }),
        challengeAndVerify: async () => ({ error: null }),
      },
    },
  }),
}));

const originalArgv = process.argv;
// The script has an explicit CLI entry point; run it entirely against in-memory
// provider/database doubles, without exporting credentials or writing accounts.
const seedModule = "../../../scripts/e2e/seed-browser-users.mjs";

describe("explicit platform browser fixture grants (F02)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    fixture.history = [];
    process.argv = ["node", "seed-browser-users.mjs", "--tenant=test-tenant"];
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fixture-service-key");
    vi.stubEnv("DATABASE_URL", "postgres://localhost/atlas_lms_e2e");
    vi.stubEnv("SUPABASE_URL", "http://localhost:54321");
    vi.stubEnv("E2E_CREDENTIALS_PATH", "");
    vi.stubEnv("E2E_SEED_PASSWORD", "fixture-password");
    vi.stubEnv("GITHUB_ENV", "");
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("seed refused");
    });
    fixture.query.mockImplementation(async (sql: string) => {
      const text = sql.toLowerCase();
      if (text.includes("insert into platform_operators")) {
        if (fixture.history.length === 0)
          fixture.history.push({ role_key: "super_admin", revoked_at: null });
        return { rows: [] };
      }
      if (text.includes("from platform_operators")) return { rows: fixture.history };
      return { rows: [{ id: "fixture-id" }] };
    });
  });
  afterEach(() => {
    process.argv = originalArgv;
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("creates a recorded database grant for a new platform fixture", async () => {
    await import(seedModule);
    expect(fixture.history).toEqual([{ role_key: "super_admin", revoked_at: null }]);
    expect(fixture.end).toHaveBeenCalledOnce();
  });

  it("does not restore a deliberately revoked fixture grant", async () => {
    fixture.history = [{ role_key: "super_admin", revoked_at: "2026-09-19T00:00:00Z" }];
    await expect(import(seedModule)).rejects.toThrow(/revoked|seed refused/i);
    expect(fixture.history).toEqual([
      { role_key: "super_admin", revoked_at: "2026-09-19T00:00:00Z" },
    ]);
    expect(fixture.end).toHaveBeenCalledOnce();
  });

  it("does not elevate a fixture deliberately downgraded to support", async () => {
    fixture.history = [{ role_key: "support", revoked_at: null }];
    await expect(import(seedModule)).rejects.toThrow(/role|seed refused/i);
    expect(fixture.history).toEqual([{ role_key: "support", revoked_at: null }]);
  });

  it("reuses an already active matching grant", async () => {
    fixture.history = [{ role_key: "super_admin", revoked_at: null }];
    await import(seedModule);
    expect(fixture.history).toHaveLength(1);
    expect(fixture.history[0]?.revoked_at).toBeNull();
  });
});
