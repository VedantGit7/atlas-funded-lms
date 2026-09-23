import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { TenantTx } from "@atlas/db";
import { readExportPage } from "@atlas/domain/data-rights/export-pages.repository";

const connectionString = process.env["F15_TEST_DATABASE_URL"];
const suite = connectionString ? describe : describe.skip;
const schema = `f15_pages_${randomUUID().replaceAll("-", "")}`;
const tenant = randomUUID(),
  otherTenant = randomUUID();
let db: Client;
let tx: TenantTx;
suite("F15 isolated PostgreSQL bounded export pages", () => {
  beforeAll(async () => {
    const url = new URL(connectionString ?? "");
    if (
      !["localhost", "127.0.0.1"].includes(url.hostname) ||
      !["/atlas_lms_test", "/atlas_lms_ci"].includes(url.pathname)
    )
      throw Error("Dedicated local test database only");
    db = new Client({ connectionString });
    await db.connect();
    await db.query(`create schema "${schema}"`);
    await db.query(`set search_path to "${schema}", public`);
    await db.query(`
      create table memberships(id uuid primary key, tenant_id uuid, status text, joined_at timestamptz);
      create table member_profiles(id uuid primary key, tenant_id uuid, membership_id uuid, display_name text);
      create table courses(id uuid primary key, tenant_id uuid, slug text, title text, status text, deleted_at timestamptz);
      create table enrollments(id uuid primary key, tenant_id uuid, course_id uuid, membership_id uuid, status text);
    `);
    await db.query("select set_config('app.tenant_id',$1,false)", [tenant]);
    tx = {
      $queryRaw: async (parts: TemplateStringsArray, ...values: unknown[]) =>
        (
          await db.query(
            parts.reduce((sql, part, i) => sql + (i ? `$${i}` : "") + part, ""),
            values,
          )
        ).rows,
    } as unknown as TenantTx;
    await db.query(
      "insert into memberships select gen_random_uuid(),$1,'ACTIVE',now() from generate_series(1,201)",
      [tenant],
    );
    await db.query("insert into memberships values(gen_random_uuid(),$1,'ACTIVE',now())", [
      otherTenant,
    ]);
  });
  afterAll(async () => {
    if (db) {
      await db.query(`drop schema if exists "${schema}" cascade`);
      await db.end();
    }
  });
  it("returns bounded nonoverlapping pages and excludes a different tenant even when requested", async () => {
    const first = await readExportPage(tx, tenant, "memberships");
    const second = await readExportPage(tx, tenant, "memberships", first.at(-1)?.cursor);
    const last = await readExportPage(tx, tenant, "memberships", second.at(-1)?.cursor);
    expect([first.length, second.length, last.length]).toEqual([100, 100, 1]);
    expect(new Set([...first, ...second, ...last].map((row) => row.cursor)).size).toBe(201);
    expect(await readExportPage(tx, otherTenant, "memberships")).toEqual([]);
  });
  it("exports only approved fields, excludes deleted courses and suppresses oversized records", async () => {
    await db.query(
      "insert into member_profiles values(gen_random_uuid(),$1,gen_random_uuid(),'Name'),(gen_random_uuid(),$1,gen_random_uuid(),repeat('x',70000))",
      [tenant],
    );
    const profiles = await readExportPage(tx, tenant, "memberProfiles");
    expect(profiles.filter((row) => row.data === null)).toHaveLength(1);
    expect(Object.keys(profiles.find((row) => row.data)?.data ?? {}).sort()).toEqual([
      "displayName",
      "membershipId",
    ]);
    await db.query(
      "insert into courses values(gen_random_uuid(),$1,'a','A','PUBLISHED',null),(gen_random_uuid(),$1,'b','B','PUBLISHED',now())",
      [tenant],
    );
    expect(await readExportPage(tx, tenant, "courses")).toHaveLength(1);
    await db.query(
      "insert into enrollments values(gen_random_uuid(),$1,gen_random_uuid(),gen_random_uuid(),'ACTIVE')",
      [tenant],
    );
    expect(
      Object.keys((await readExportPage(tx, tenant, "enrollments"))[0]?.data ?? {}).sort(),
    ).toEqual(["courseId", "id", "membershipId", "status"]);
  });
});
