# Composite tenant foreign keys (audit M3)

Row-level security hides other tenants' rows from reads. It never stopped a
write that names one: before audit M3, most core tables had no foreign keys at
all, so a row could reference another tenant's course, member or order (or a
row that did not exist) whenever application code trusted an id it was given.

Every reference on the learning, money and access paths is now a composite
foreign key:

```sql
FOREIGN KEY (tenant_id, <parent>_id) REFERENCES <parent> (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT
```

The parent must exist and belong to the same tenant. The full list (44
references across 26 tables) is `scripts/db/tenant-fk-spec.mjs`; migrations 120
and 121 and the Prisma schema must match it, which
`tests/unit/db/tenant-fk-spec.test.ts` checks.

## Deploying

The change ships in two migrations:

- **120** adds each parent's `(tenant_id, id)` key and the constraints
  `NOT VALID`. New writes are checked from this point; existing rows are not.
  Building the 13 parent keys briefly blocks writes to those tables.
- **121** validates existing rows. It holds only a `SHARE UPDATE EXCLUSIVE`
  lock, so traffic continues while each table is scanned.

**Before deploying, run the integrity check against the target database** with
an owner/admin login that has complete RLS visibility:

```bash
TENANT_FK_INTEGRITY_DATABASE_URL=... pnpm db:tenant-fk:check
```

It lists every reference with rows that migration 121 would reject, split into
missing parents and parents of another tenant, with sample row ids. It exits 0
only when there are none. Resolve those rows first (they are data defects:
each one is a record pointing at nothing, or at another tenant), then deploy.

If migration 121 fails anyway, nothing is lost: 120 keeps protecting new
writes. Run the check, resolve the rows it lists, and re-run the deploy. After
deploying, run the check again; it should report every constraint `validated`.

## Deleting

`ON DELETE RESTRICT` everywhere. These parents are soft-deleted (memberships,
courses, assessments, items, roles) or have their children removed first
(coupons, roles' permissions and grants, a draft assessment's items), so a
hard delete that would orphan children is a bug to surface, not a case to
cascade. A delete that hits a constraint fails with Postgres error `23503`
naming it.

## Adding a reference

A new tenant table that references another tenant table gets the same
constraint, added `NOT VALID` and validated in a following migration, with the
parent's `(tenant_id, id)` key if it has none, the relation mirrored in
`schema.prisma` (`references: [tenant_id, id]`, `map:` the constraint name),
and an entry in `scripts/db/tenant-fk-spec.mjs`.

References outside these paths (marketing, community, gamification, reports)
and polymorphic columns (`resource_id`, `target_id`) are not covered yet.
