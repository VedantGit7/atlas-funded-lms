import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { withTenantTx, type TenantTx } from "@atlas/db";
import {
  authoringTenantTx,
  createCourseAuthoringFixture,
  type CourseAuthoringFixture,
} from "../../fixtures/course-authoring-fixture";
import { marketingIntegrationsRepository } from "../../../backend/apps/api/src/server/marketing-integrations/marketing-integrations.repository";
import {
  getPublicMarketingIntegrationSnippetsForViewer,
  MARKETING_SNIPPETS_UPDATED,
  summarizeSnippet,
  updateMarketingIntegrationSnippets,
} from "../../../backend/apps/api/src/server/marketing-integrations/marketing-integrations.service";

/**
 * Tenant snippets run with the viewer's authority on this origin (audit H5):
 * learners and anonymous visitors get them, anyone holding a staff role does not.
 */
const suite =
  process.env.DATABASE_URL && process.env.PLATFORM_DATABASE_URL ? describe : describe.skip;

suite("marketing snippets by viewer", () => {
  let fixture: CourseAuthoringFixture;
  const asTenant = <T>(fn: (tx: TenantTx) => Promise<T>) =>
    withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), fn);
  const forViewer = (principalId: string | null) =>
    asTenant((tx) =>
      getPublicMarketingIntegrationSnippetsForViewer(tx, {
        tenantId: fixture.tenantId,
        principalId,
      }),
    );

  beforeAll(async () => {
    fixture = await createCourseAuthoringFixture();
    await asTenant((tx) =>
      marketingIntegrationsRepository.updateSnippets(tx, {
        siteBodyHtml: '<script src="https://tags.example.test/t.js"></script>',
        orderTrackingHtml: "<img alt='' src='https://pixel.example.test/o'>",
        signupTrackingHtml: "<img alt='' src='https://pixel.example.test/s'>",
      }),
    );
  });

  it("serves the tenant's snippets to anonymous visitors and learners", async () => {
    for (const principalId of [null, fixture.learnerPrincipalId]) {
      const result = await forViewer(principalId);
      expect(result.data.siteBodyHtml).toContain("tags.example.test");
      expect(result.data.signupTrackingHtml).toContain("pixel.example.test/s");
    }
  });

  it("serves nothing to admins and instructors", async () => {
    for (const principalId of [fixture.adminPrincipalId, fixture.instructorPrincipalId]) {
      expect(await forViewer(principalId)).toEqual({
        data: { siteBodyHtml: null, orderTrackingHtml: null, signupTrackingHtml: null },
      });
    }
  });

  it("treats a custom role as staff", async () => {
    await asTenant(async (tx) => {
      const roleId = randomUUID();
      await tx.$executeRaw`
        insert into roles (id, tenant_id, key, name, is_system, created_at, updated_at)
        values (${roleId}::uuid, ${fixture.tenantId}::uuid, ${`support-${roleId.slice(0, 8)}`},
                'Support', false, now(), now())
      `;
      await tx.$executeRaw`
        insert into user_roles (id, tenant_id, membership_id, role_id, assigned_by_membership_id, created_at)
        values (${randomUUID()}::uuid, ${fixture.tenantId}::uuid, ${fixture.learnerMembershipId}::uuid,
                ${roleId}::uuid, ${fixture.adminMembershipId}::uuid, now())
      `;
    });
    expect((await forViewer(fixture.learnerPrincipalId)).data.siteBodyHtml).toBeNull();
  });

  it("audits every snippet change with a fingerprint and the scripts it loads", async () => {
    const html =
      '<script src="https://cdn.tracker.example.test/a.js"></script><script>window.track()</script>';
    const requestId = randomUUID();
    await asTenant((tx) =>
      updateMarketingIntegrationSnippets(
        tx,
        { tenantId: fixture.tenantId, actorMembershipId: fixture.adminMembershipId, requestId },
        { siteBodyHtml: html },
      ),
    );
    const rows = await asTenant(
      (tx) => tx.$queryRaw<
        Array<{
          action: string;
          actor_membership_id: string;
          after_json: unknown;
          metadata_json: unknown;
        }>
      >`
        select action, actor_membership_id::text, after_json, metadata_json
        from audit_entries
        where request_id = ${requestId}
      `,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      action: MARKETING_SNIPPETS_UPDATED,
      actor_membership_id: fixture.adminMembershipId,
      metadata_json: { fields: ["siteBodyHtml"] },
      after_json: {
        siteBodyHtml: {
          scriptOrigins: ["https://cdn.tracker.example.test"],
          inlineScripts: 1,
          length: html.length,
          sha256: summarizeSnippet(html)?.sha256,
        },
      },
    });

    // Saving the same content again is not a change.
    const unchanged = randomUUID();
    await asTenant((tx) =>
      updateMarketingIntegrationSnippets(
        tx,
        {
          tenantId: fixture.tenantId,
          actorMembershipId: fixture.adminMembershipId,
          requestId: unchanged,
        },
        { siteBodyHtml: html },
      ),
    );
    const none = await asTenant(
      (tx) => tx.$queryRaw<Array<{ count: bigint }>>`
        select count(*)::bigint as count from audit_entries where request_id = ${unchanged}
      `,
    );
    expect(Number(none[0]?.count)).toBe(0);
  });
});
