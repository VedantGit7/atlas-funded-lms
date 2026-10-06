import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CORE_TENANT_FOREIGN_KEYS,
  COVERAGE_TENANT_FOREIGN_KEYS,
  TENANT_FOREIGN_KEYS,
} from "../../../scripts/db/tenant-fk-spec.mjs";

/**
 * Audit M3: the integrity check, the migrations and the Prisma schema
 * describe the same composite tenant foreign keys. If one changes without the
 * others, the pre-deploy check would inspect the wrong constraints, or
 * `prisma migrate dev` would generate a migration that drops them.
 */
const root = resolve(__dirname, "../../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8").replace(/\r\n/g, "\n");
const migration = (name: string) => read(`backend/prisma/migrations/${name}/migration.sql`);
const stages = [
  {
    label: "core (120/121)",
    keys: CORE_TENANT_FOREIGN_KEYS,
    added: migration("20261006120000_120_tenant_composite_fks"),
    validated: migration("20261006120100_121_validate_tenant_composite_fks"),
  },
  {
    label: "coverage (122/123)",
    keys: COVERAGE_TENANT_FOREIGN_KEYS,
    added: migration("20261006130000_122_tenant_composite_fks_coverage"),
    validated: migration("20261006130100_123_validate_tenant_composite_fks_coverage"),
  },
];
const schema = read("backend/prisma/schema.prisma");

describe("composite tenant foreign keys (audit M3)", () => {
  it.each(stages)("$label: adds exactly the constraints the check inspects, NOT VALID", (stage) => {
    const inMigration = [
      ...stage.added.matchAll(
        /ALTER TABLE public\.(\w+)\n {2}ADD CONSTRAINT (\w+)\n {2}FOREIGN KEY \(tenant_id, (\w+)\) REFERENCES public\.(\w+) \(tenant_id, id\)\n {2}ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;/g,
      ),
    ].map(([, child, name, column, parent]) => ({ child, column, parent, name }));
    expect(inMigration).toEqual([...stage.keys]);
  });

  it.each(stages)("$label: validates every one of them in the second stage", (stage) => {
    const validatedNames = [
      ...stage.validated.matchAll(/ALTER TABLE public\.(\w+) VALIDATE CONSTRAINT (\w+);/g),
    ].map(([, , name]) => name);
    expect(validatedNames).toEqual(stage.keys.map((fk) => fk.name));
  });

  it("constrains each reference once", () => {
    const references = TENANT_FOREIGN_KEYS.map((fk) => `${fk.child}.${fk.column}`);
    expect(new Set(references).size).toBe(references.length);
  });

  it("gives every referenced parent a (tenant_id, id) key", () => {
    const keyed = new Set([
      ...stages.flatMap((stage) =>
        [...stage.added.matchAll(/ON public\.(\w+) \(tenant_id, id\);/g)].map(([, table]) => table),
      ),
      // Created by earlier migrations (108, 114).
      "payment_orders",
      "proctoring_sessions",
    ]);
    for (const fk of TENANT_FOREIGN_KEYS) expect(keyed.has(fk.parent), fk.parent).toBe(true);
  });

  it("mirrors each constraint in the Prisma schema", () => {
    for (const fk of TENANT_FOREIGN_KEYS) {
      const relation =
        `fields: [tenant_id, ${fk.column}], references: [tenant_id, id], ` +
        `onDelete: Restrict, onUpdate: Restrict, map: "${fk.name}")`;
      // A relation name comes first when two relations join the same models.
      const named = schema.includes(`@relation("${fk.name}", ${relation}`);
      expect(named || schema.includes(`@relation(${relation}`), fk.name).toBe(true);
    }
  });

  it("keeps every constraint name within Postgres' 63-character limit", () => {
    for (const fk of TENANT_FOREIGN_KEYS) expect(fk.name.length).toBeLessThanOrEqual(63);
  });

  it("leaves actor attribution and polymorphic references unconstrained", () => {
    const attribution = /_by_membership_id$|^actor_membership_id$/;
    const unconstrained = new Set([
      "bundle_items.ref_id",
      "mentions.source_id",
      "search_index_entries.source_id",
      "storage_references.resource_id",
      // Rules are hard-deleted; their append-only run history is kept.
      "automation_runs.automation_rule_id",
    ]);
    for (const fk of TENANT_FOREIGN_KEYS) {
      expect(fk.column, fk.name).not.toMatch(attribution);
      expect(unconstrained.has(`${fk.child}.${fk.column}`), fk.name).toBe(false);
    }
  });
});
