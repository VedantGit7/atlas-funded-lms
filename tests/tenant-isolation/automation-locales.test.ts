import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import {
  createAutomationRule,
  listAutomationRules,
} from "../../apps/web/src/server/automation/automation.service";
import { upsertLocaleResources } from "../../apps/web/src/server/locales/locale.service";
import {
  adminCtx,
  authoringTenantTx,
  createCertificateFixture,
} from "../fixtures/certificate-fixture";
import { createTenantIsolationFixture, tenantCtx } from "./tenant-isolation-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

const AUTOMATION_LOCALE_TABLES = [
  "automation_rules",
  "automation_runs",
  "locale_resources",
] as const;

describeWithDb("automation and locale tenant isolation", () => {
  it("RLS filters automation and locale tables to current tenant", async () => {
    const fixture = await createCertificateFixture();
    const isolation = await createTenantIsolationFixture();
    const admin = adminCtx(fixture, "req_iso_automation");

    await withTenantTx(authoringTenantTx(fixture), async (tx) => {
      await createAutomationRule(tx, admin, {
        key: "iso.rule",
        triggerEventType: "certificate.issued",
        actionJson: {
          type: "notification.request",
          templateKey: "certificate.issued",
        },
      });
      await upsertLocaleResources(tx, admin, "en", {
        resources: [{ key: "iso.key", value: "Iso value" }],
      });
    });

    for (const table of AUTOMATION_LOCALE_TABLES) {
      const rows = await withTenantTx(tenantCtx(isolation.tenantA), async (tx) =>
        tx.$queryRawUnsafe<Array<{ tenant_id: string }>>(
          `select tenant_id::text from ${table} where tenant_id = $1::uuid`,
          fixture.tenantId,
        ),
      );
      expect(rows).toHaveLength(0);
    }
  });

  it("prevents cross-tenant automation rule reads through service", async () => {
    const fixture = await createCertificateFixture();
    const isolation = await createTenantIsolationFixture();
    const admin = adminCtx(fixture, "req_iso_automation_read");

    const created = await withTenantTx(authoringTenantTx(fixture), async (tx) =>
      createAutomationRule(tx, admin, {
        key: "iso.read",
        triggerEventType: "certificate.issued",
        actionJson: {
          type: "notification.request",
          templateKey: "certificate.issued",
        },
      }),
    );

    const tenantRules = await withTenantTx(tenantCtx(isolation.tenantA), async (tx) =>
      listAutomationRules(tx, {
        tenantId: isolation.tenantA.tenantId,
        actorMembershipId: isolation.tenantA.membershipId,
        requestId: "req_iso_list",
      }),
    );

    expect(tenantRules.data.find((rule) => rule.id === created.data.id)).toBeUndefined();
  });
});
