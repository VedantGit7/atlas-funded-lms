import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import { createCompetencyProjectionFixture } from "../fixtures/competency-projection-fixture";
import { authoringTenantTx } from "../fixtures/assessment-fixture";
import { createTenantIsolationFixture, tenantCtx } from "./tenant-isolation-fixture";
import {
  getPublicDiagnosticResult,
  startPublicDiagnosticSession,
} from "../../apps/web/src/modules/diagnostics/diagnostic-public-session.service";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

function requireAnonymousId(anonymousId: string | null): string {
  if (!anonymousId) throw new Error("Missing anonymous id");
  return anonymousId;
}

describeWithDb("diagnostic tenant isolation", () => {
  it("tenant A cookie/session cannot read tenant B public result", async () => {
    const fixtureA = await createCompetencyProjectionFixture();
    const isolation = await createTenantIsolationFixture();

    await withTenantTx(authoringTenantTx(fixtureA), async (tx) => {
      await tx.$executeRaw`
        update assessments
        set assessment_type = 'diagnostic', status = 'PUBLISHED'
        where id = ${fixtureA.assessmentId}::uuid
      `;
    });

    const started = await withTenantTx(
      { tenantId: fixtureA.tenantId, requestId: "req_iso_a", allowAnonymousTenantRead: true },
      async (tx) =>
        startPublicDiagnosticSession({
          tx,
          ctx: { tenantId: fixtureA.tenantId, requestId: "req_iso_a" },
          req: new Request("https://tenant-a.example.com", {
            headers: { "x-forwarded-for": "203.0.113.47" },
          }),
        }),
    );

    await expect(
      withTenantTx(tenantCtx(isolation.tenantB), async (tx) =>
        getPublicDiagnosticResult({
          tx,
          ctx: { tenantId: isolation.tenantB.tenantId, requestId: "req_iso_b" },
          anonymousId: requireAnonymousId(started.session.anonymous_id),
          secret: started.proof.secret,
        }),
      ),
    ).rejects.toMatchObject({ status: 401 });
  });
});
