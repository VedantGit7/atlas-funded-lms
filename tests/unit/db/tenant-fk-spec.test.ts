import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { TENANT_FOREIGN_KEYS } from "../../../scripts/db/tenant-fk-spec.mjs";

/**
 * Audit M3: the integrity check, the two migrations and the Prisma schema
 * describe the same composite tenant foreign keys. If one changes without the
 * others, the pre-deploy check would inspect the wrong constraints, or
 * `prisma migrate dev` would generate a migration that drops them.
 */
const root = resolve(__dirname, "../../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8").replace(/\r\n/g, "\n");
const added = read(
  "backend/prisma/migrations/20261006120000_120_tenant_composite_fks/migration.sql",
);
const validated = read(
  "backend/prisma/migrations/20261006120100_121_validate_tenant_composite_fks/migration.sql",
);
const schema = read("backend/prisma/schema.prisma");

describe("composite tenant foreign keys (audit M3)", () => {
  it("adds exactly the constraints the integrity check inspects, NOT VALID", () => {
    const inMigration = [
      ...added.matchAll(
        /ALTER TABLE public\.(\w+)\n {2}ADD CONSTRAINT (\w+)\n {2}FOREIGN KEY \(tenant_id, (\w+)\) REFERENCES public\.(\w+) \(tenant_id, id\)\n {2}ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;/g,
      ),
    ].map(([, child, name, column, parent]) => ({ child, column, parent, name }));
    expect(inMigration).toEqual([...TENANT_FOREIGN_KEYS]);
  });

  it("validates every one of them in the second stage", () => {
    const validatedNames = [
      ...validated.matchAll(/ALTER TABLE public\.(\w+) VALIDATE CONSTRAINT (\w+);/g),
    ].map(([, , name]) => name);
    expect(validatedNames).toEqual(TENANT_FOREIGN_KEYS.map((fk) => fk.name));
  });

  it("gives every referenced parent a (tenant_id, id) key", () => {
    const keyed = new Set([
      ...[...added.matchAll(/ON public\.(\w+) \(tenant_id, id\);/g)].map(([, table]) => table),
      // Created by earlier migrations (108, 114).
      "payment_orders",
      "proctoring_sessions",
    ]);
    for (const fk of TENANT_FOREIGN_KEYS) expect(keyed.has(fk.parent), fk.parent).toBe(true);
  });

  it("mirrors each constraint in the Prisma schema", () => {
    for (const fk of TENANT_FOREIGN_KEYS) {
      expect(schema, fk.name).toContain(
        `@relation(fields: [tenant_id, ${fk.column}], references: [tenant_id, id], onDelete: Restrict, onUpdate: Restrict, map: "${fk.name}")`,
      );
    }
  });

  it("keeps every constraint name within Postgres' 63-character limit", () => {
    for (const fk of TENANT_FOREIGN_KEYS) expect(fk.name.length).toBeLessThanOrEqual(63);
  });
});
