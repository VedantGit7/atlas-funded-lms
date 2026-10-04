import { describe, expect, it, vi } from "vitest";
import { upsertAuthPrincipal } from "@atlas/auth";

/**
 * Branch coverage for principal resolution (audit H6). The SQL itself is
 * exercised against Postgres in tests/integration/auth/principal-resolution.test.ts;
 * here a fake answers each statement by its shape.
 */

type Statement = "bound" | "claim" | "insert" | "owner" | "relink";

function classify(sql: TemplateStringsArray): Statement {
  const text = sql.join("?").toLowerCase();
  if (text.includes("auth_principal_relink_requests")) return "relink";
  if (text.includes("with bound as")) return "bound";
  if (text.includes("global_status = 'unclaimed'")) return "claim";
  if (text.includes("insert into auth_principals")) return "insert";
  return "owner";
}

function fakeDb(answers: Partial<Record<Statement, unknown[][]>>) {
  const calls: Statement[] = [];
  const queues = Object.fromEntries(
    Object.entries(answers).map(([key, value]) => [key, [...value]]),
  ) as Partial<Record<Statement, unknown[][]>>;
  const db = {
    $queryRaw: vi.fn(async (sql: TemplateStringsArray) => {
      const statement = classify(sql);
      calls.push(statement);
      return queues[statement]?.shift() ?? [];
    }),
  };
  return { db, calls };
}

const row = (overrides: Record<string, unknown> = {}) => ({
  id: "018f0000-0000-7000-8000-000000000010",
  email: "user@example.com",
  email_normalized: "user@example.com",
  global_status: "active",
  mfa_enabled: false,
  last_login_at: null,
  ...overrides,
});

const base = {
  supabaseUserId: "018f0000-0000-7000-8000-000000000099",
  email: "User@Example.com",
};

describe("upsertAuthPrincipal (audit H6)", () => {
  it("returns the principal bound to this Supabase user without touching others", async () => {
    const { db, calls } = fakeDb({ bound: [[row()]] });
    const principal = await upsertAuthPrincipal({ db, ...base, emailConfirmed: false });
    expect(principal).toMatchObject({ id: row().id, emailNormalized: "user@example.com" });
    expect(calls).toEqual(["bound"]);
  });

  it("refuses a disabled principal", async () => {
    const { db } = fakeDb({ bound: [[row({ global_status: "disabled" })]] });
    await expect(upsertAuthPrincipal({ db, ...base, emailConfirmed: true })).rejects.toMatchObject({
      code: "ACCOUNT_DISABLED",
      status: 403,
    });
  });

  it("creates or claims nothing for an unconfirmed email", async () => {
    const { db, calls } = fakeDb({});
    await expect(upsertAuthPrincipal({ db, ...base, emailConfirmed: false })).rejects.toMatchObject(
      { code: "EMAIL_NOT_VERIFIED", status: 403 },
    );
    expect(calls).toEqual(["bound"]);
  });

  it("claims an unclaimed placeholder for a confirmed email", async () => {
    const { db, calls } = fakeDb({ claim: [[row()]] });
    const principal = await upsertAuthPrincipal({ db, ...base, emailConfirmed: true });
    expect(principal.id).toBe(row().id);
    expect(calls).toEqual(["bound", "claim"]);
  });

  it("creates a principal for a confirmed email nobody holds", async () => {
    const { db, calls } = fakeDb({
      insert: [[row({ id: "018f0000-0000-7000-8000-000000000011" })]],
    });
    const principal = await upsertAuthPrincipal({ db, ...base, emailConfirmed: true });
    expect(principal.id).toBe("018f0000-0000-7000-8000-000000000011");
    expect(calls).toEqual(["bound", "claim", "insert"]);
  });

  it("never re-points an account held by another Supabase user: records a relink request and refuses", async () => {
    const { db, calls } = fakeDb({
      owner: [
        [
          {
            id: row().id,
            supabase_user_id: "018f0000-0000-7000-8000-0000000000aa",
            global_status: "active",
          },
        ],
      ],
    });
    await expect(upsertAuthPrincipal({ db, ...base, emailConfirmed: true })).rejects.toMatchObject({
      code: "ACCOUNT_REVIEW_REQUIRED",
      status: 409,
    });
    expect(calls).toEqual(["bound", "claim", "insert", "owner", "relink"]);
  });

  it("resolves a concurrent first sign-in by finding the winner's row on the second pass", async () => {
    const { db, calls } = fakeDb({ bound: [[], [row()]] });
    const principal = await upsertAuthPrincipal({ db, ...base, emailConfirmed: true });
    expect(principal.id).toBe(row().id);
    expect(calls).toEqual(["bound", "claim", "insert", "owner", "bound"]);
  });
});
