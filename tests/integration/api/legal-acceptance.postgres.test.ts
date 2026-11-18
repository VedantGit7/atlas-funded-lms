import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withPlatformScope, withTenantTx } from "@atlas/db";
import { resolveSignInMembership } from "../../../backend/apps/api/src/lib/sign-in-membership";
import { consentFrom } from "../../../backend/apps/api/src/server/tenant-settings/legal-acceptance.service";
import {
  createTenantIsolationFixture,
  tenantCtx,
  type IsolationTenantFixture,
} from "../../tenant-isolation/tenant-isolation-fixture";

const suite = process.env["DATABASE_URL"] ? describe : describe.skip;

function platformScope(tenantId: string) {
  return {
    principalId: randomUUID(),
    requestId: randomUUID(),
    requiredPermission: "platform.tenant.manage" as const,
    platformPermissions: ["platform.tenant.manage" as const],
    touchedTenantIds: [tenantId],
  };
}

async function newPrincipal(
  tenant: IsolationTenantFixture,
): Promise<{ id: string; email: string }> {
  const id = randomUUID();
  const email = `join-${id.slice(0, 8)}@example.test`;
  await withPlatformScope(
    platformScope(tenant.tenantId),
    "Creating a legal acceptance test principal",
    async (tx) => {
      await tx.$executeRaw`
        insert into auth_principals (id, email, email_normalized, global_status, created_at, updated_at)
        values (${id}::uuid, ${email}, ${email}, 'active', now(), now())
      `;
    },
  );
  return { id, email };
}

async function publishLegal(tenant: IsolationTenantFixture): Promise<void> {
  const doc = (slug: "terms" | "privacy") => ({
    slug,
    title: slug,
    subtitle: "",
    lastUpdated: slug === "terms" ? "November 18, 2026" : "November 17, 2026",
    sections: [],
  });
  const config = JSON.stringify({ legal: { terms: doc("terms"), privacy: doc("privacy") } });
  await withPlatformScope(
    platformScope(tenant.tenantId),
    "Publishing legal documents for a legal acceptance test",
    async (tx) => {
      await tx.$executeRaw`
        insert into tenant_config (id, tenant_id, config_json, created_at, updated_at)
        values (${randomUUID()}::uuid, ${tenant.tenantId}::uuid, ${config}::jsonb, now(), now())
        on conflict (tenant_id) do update set config_json = excluded.config_json, updated_at = now()
      `;
    },
  );
}

async function acceptances(tenant: IsolationTenantFixture, membershipId: string) {
  return withTenantTx(
    tenantCtx(tenant),
    async (tx) =>
      tx.$queryRaw<
        Array<{ source: string; terms_version: string | null; privacy_version: string | null }>
      >`
      select source, terms_version, privacy_version
      from tenant_legal_acceptances
      where membership_id = ${membershipId}::uuid
    `,
  );
}

suite("launch plan 5.7: no membership opens without agreement (PostgreSQL)", () => {
  it("opens nothing for a signed-in newcomer who has not agreed, and asks", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const person = await newPrincipal(tenantA);
    const result = await withTenantTx(tenantCtx(tenantA), async (tx) =>
      resolveSignInMembership(tx, {
        tenantId: tenantA.tenantId,
        principalId: person.id,
        email: person.email,
        provision: true,
      }),
    );
    expect(result).toEqual({ membership: null, termsRequired: true });
    const rows = await withTenantTx(
      tenantCtx(tenantA),
      async (tx) =>
        tx.$queryRaw<Array<{ n: number }>>`
        select count(*)::int as n from memberships where auth_principal_id = ${person.id}::uuid
      `,
    );
    expect(rows).toEqual([{ n: 0 }]);
    // No membership ties this principal to a test tenant, so the tenant
    // cleanup would not find it.
    await withPlatformScope(
      platformScope(tenantA.tenantId),
      "Removing a legal acceptance test principal",
      async (tx) => {
        await tx.$executeRaw`delete from auth_principals where id = ${person.id}::uuid`;
      },
    );
  });

  it("opens the membership with agreement and records which versions were agreed to", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await publishLegal(tenantA);
    const person = await newPrincipal(tenantA);
    const result = await withTenantTx(tenantCtx(tenantA), async (tx) =>
      resolveSignInMembership(tx, {
        tenantId: tenantA.tenantId,
        principalId: person.id,
        email: person.email,
        provision: true,
        consent: { source: "google_signup", acceptedAt: new Date() },
      }),
    );
    expect(result.termsRequired).toBe(false);
    expect(result.membership?.status).toBe("ACTIVE");
    expect(await acceptances(tenantA, result.membership?.id ?? "")).toEqual([
      {
        source: "google_signup",
        terms_version: "November 18, 2026",
        privacy_version: "November 17, 2026",
      },
    ]);
  });

  it("asks an existing member with no recorded agreement, and records it once given", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const signIn = (consent?: { source: "join"; acceptedAt: Date }) =>
      withTenantTx(tenantCtx(tenantA), async (tx) =>
        resolveSignInMembership(tx, {
          tenantId: tenantA.tenantId,
          principalId: tenantA.principalId,
          email: `${tenantA.slug}@example.test`,
          provision: true,
          consent,
        }),
      );
    expect(await signIn()).toEqual({
      membership: { id: tenantA.membershipId, status: "ACTIVE" },
      termsRequired: true,
    });
    expect((await signIn({ source: "join", acceptedAt: new Date() })).termsRequired).toBe(false);
    // Unpublished documents are recorded as such, not guessed.
    expect(await acceptances(tenantA, tenantA.membershipId)).toEqual([
      { source: "join", terms_version: null, privacy_version: null },
    ]);
    // Once recorded, an ordinary sign-in goes straight through.
    expect((await signIn()).termsRequired).toBe(false);
  });

  it("keeps another academy's agreement records out of reach", async () => {
    const { tenantA, tenantB } = await createTenantIsolationFixture();
    await withTenantTx(tenantCtx(tenantA), async (tx) =>
      resolveSignInMembership(tx, {
        tenantId: tenantA.tenantId,
        principalId: tenantA.principalId,
        email: `${tenantA.slug}@example.test`,
        provision: true,
        consent: { source: "join", acceptedAt: new Date() },
      }),
    );
    const seenFromB = await withTenantTx(
      tenantCtx(tenantB),
      async (tx) =>
        tx.$queryRaw<Array<{ n: number }>>`select count(*)::int as n from tenant_legal_acceptances`,
    );
    expect(seenFromB).toEqual([{ n: 0 }]);
  });
});

describe("consentFrom", () => {
  const now = new Date("2026-11-18T12:00:00Z");
  it("accepts an agreement from the last day", () => {
    expect(consentFrom("signup", "2026-11-18T11:00:00Z", now)).toEqual({
      source: "signup",
      acceptedAt: new Date("2026-11-18T11:00:00Z"),
    });
  });
  it("refuses a missing, malformed, future or stale one", () => {
    expect(consentFrom("signup", undefined, now)).toBeNull();
    expect(consentFrom("signup", "not a date", now)).toBeNull();
    expect(consentFrom("signup", "2026-11-18T13:00:00Z", now)).toBeNull();
    expect(consentFrom("signup", "2026-11-16T11:00:00Z", now)).toBeNull();
  });
});
