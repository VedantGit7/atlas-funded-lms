import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import { createCompetencyProjectionFixture } from "../fixtures/competency-projection-fixture";
import { authoringTenantTx, learnerCtx } from "../fixtures/assessment-fixture";
import {
  getAuthenticatedDiagnosticResult,
  startAuthenticatedDiagnostic,
} from "../../apps/web/src/modules/diagnostics/diagnostic-authenticated.service";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithDb("diagnostic authorization", () => {
  it("authenticated diagnostic allows own session and denies foreign session", async () => {
    const fixture = await createCompetencyProjectionFixture();

    await withTenantTx(authoringTenantTx(fixture), async (tx) => {
      await tx.$executeRaw`
        update assessments
        set assessment_type = 'diagnostic', status = 'PUBLISHED'
        where id = ${fixture.assessmentId}::uuid
      `;
    });

    const started = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) =>
        startAuthenticatedDiagnostic({
          tx,
          ctx: learnerCtx(fixture, "req_auth_diag_start"),
          idempotencyKey: "auth-diag-start",
        }),
    );

    expect(started.data.sessionId).toBeTruthy();

    await expect(
      withTenantTx(authoringTenantTx(fixture, fixture.instructorMembershipId), async (tx) =>
        getAuthenticatedDiagnosticResult({
          tx,
          ctx: {
            tenantId: fixture.tenantId,
            actorMembershipId: fixture.instructorMembershipId,
            requestId: "req_foreign_diag",
          },
          sessionId: started.data.sessionId,
        }),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
});
