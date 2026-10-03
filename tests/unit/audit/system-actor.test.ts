import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SYSTEM_ACTOR_MEMBERSHIP_ID,
  isSystemActor,
  systemServiceCtx,
} from "@atlas/core/actor/system-actor";

/**
 * Audit finding M16 — actor identity at system entry points.
 *
 * Six routes, including both payment webhooks, passed
 * `actorMembershipId: tenant.tenantId`. A tenant id is not a membership id, so
 * every audit entry on the most financially sensitive events in the product
 * attributed the action to a membership that does not exist — joining
 * `audit_entries` to `memberships` returned nothing, and the trail answered
 * "who did this?" with a value from the wrong table.
 */

const SYSTEM_ROUTES = [
  "backend/apps/api/src/app/api/v1/payments/webhooks/stripe/route.ts",
  "backend/apps/api/src/app/api/v1/payments/webhooks/razorpay/route.ts",
  "backend/apps/api/src/app/api/v1/zoom/webhooks/route.ts",
  "backend/apps/api/src/app/api/v1/public/marketing/integrations/actions/sign-up/route.ts",
  "backend/apps/api/src/app/api/v1/public/marketing/integrations/actions/paid-enrollment/route.ts",
  "backend/apps/api/src/app/api/v1/public/sales/attribution/route.ts",
];

describe("system actor", () => {
  it("is a sentinel that cannot collide with a real membership", () => {
    // Memberships are UUID v7 (version nibble 7); the nil UUID is unreachable.
    expect(SYSTEM_ACTOR_MEMBERSHIP_ID).toBe("00000000-0000-0000-0000-000000000000");
    expect(isSystemActor(SYSTEM_ACTOR_MEMBERSHIP_ID)).toBe(true);
    expect(isSystemActor("018f0000-0000-7000-8000-000000000030")).toBe(false);
    expect(isSystemActor(null)).toBe(false);
    expect(isSystemActor(undefined)).toBe(false);
  });

  it("carries the originating system", () => {
    const ctx = systemServiceCtx({
      tenantId: "7ff731be-6b5c-418c-a308-af169783101a",
      requestId: "req_test",
      source: "payments.stripe.webhook",
    });

    expect(ctx.actorMembershipId).toBe(SYSTEM_ACTOR_MEMBERSHIP_ID);
    expect(ctx.systemSource).toBe("payments.stripe.webhook");
    expect(ctx.tenantId).toBe("7ff731be-6b5c-418c-a308-af169783101a");
  });

  it("is used by every un-attributable entry point", () => {
    for (const route of SYSTEM_ROUTES) {
      const source = readFileSync(route, "utf8");

      // The regression: a tenant id standing in for a membership id.
      expect(source, `${route} must not fabricate an actor`).not.toContain(
        "actorMembershipId: tenant.tenantId",
      );
      expect(source, `${route} must declare a system actor`).toContain("systemServiceCtx(");
    }
  });

  it("persists the system actor as NULL, not as the sentinel", () => {
    // The sentinel exists so `ServiceCtx.actorMembershipId` can stay a
    // non-nullable string; writing it to a foreign-key-shaped column would
    // repeat the original defect. The writer must map it to NULL.
    const writer = readFileSync("backend/packages/audit/src/services/audit-writer.ts", "utf8");
    expect(writer).toContain("isSystemActor");
    expect(writer).toContain("actorMembershipId: null");
    expect(writer).toContain("systemSource");
  });
});

describe("no new entry point repeats the mistake (M16)", () => {
  // The check above walks a hardcoded list of the six routes the audit named,
  // so a *seventh* route making the same substitution would pass it silently.
  // Phase 3.4 asked for branded TenantId/MembershipId types to make this a
  // compile error; that remains open because it touches ~1500 references. This
  // scans the whole tree for the anti-pattern instead, which buys the same
  // recurrence protection at a fraction of the cost.
  const ROOTS = [
    resolve(import.meta.dirname, "../../../backend/apps/api/src"),
    resolve(import.meta.dirname, "../../../frontend/apps/web/src"),
  ];

  function walk(dir: string, out: string[] = []): string[] {
    if (!existsSync(dir)) return out;
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) {
        walk(path, out);
        continue;
      }
      if (/\.tsx?$/.test(entry)) out.push(path);
    }
    return out;
  }

  const files = ROOTS.flatMap((root) => walk(root));

  it("finds the tree it is meant to be scanning", () => {
    // Guards the guard: a walk that matched nothing would make the assertion
    // below vacuous, which is the exact failure mode this programme has hit
    // before with checks that scanned zero files.
    expect(files.length).toBeGreaterThan(200);
  });

  it("never assigns a tenant id to actorMembershipId", () => {
    // Matches `actorMembershipId: <something tenant-ish>` in any spelling —
    // tenant.tenantId, tenantId, ctx.tenantId, resolvedTenant.tenantId.
    const offenders: string[] = [];
    const pattern = /actorMembershipId:\s*(?:[A-Za-z_$][\w$]*\.)?tenantId\b/;

    for (const file of files) {
      if (pattern.test(readFileSync(file, "utf8"))) {
        offenders.push(
          relative(resolve(import.meta.dirname, "../../.."), file).replace(/\\/g, "/"),
        );
      }
    }

    expect(offenders, "a tenant id is not a membership id").toEqual([]);
  });
});
