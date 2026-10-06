# Composite tenant foreign keys (audit M3)

Row-level security hides other tenants' rows from reads. It never stopped a
write that names one: before audit M3, most core tables had no foreign keys at
all, so a row could reference another tenant's course, member or order (or a
row that did not exist) whenever application code trusted an id it was given.

Every reference between tenant tables whose parent is unambiguous is now a
composite foreign key:

```sql
FOREIGN KEY (tenant_id, <parent>_id) REFERENCES <parent> (tenant_id, id)
  ON DELETE RESTRICT ON UPDATE RESTRICT
```

The parent must exist and belong to the same tenant. The full list is
`scripts/db/tenant-fk-spec.mjs`, in two parts:

- **Core** (44 references across 26 tables, migrations 120 and 121): the
  learning, money and access paths.
- **Coverage** (135 references across 94 tables, migrations 122 and 123):
  community, engagement, competency and practice, live classes, paths,
  marketing, sales programmes, test series, messaging and integrations.

The migrations and the Prisma schema must match the list, which
`tests/unit/db/tenant-fk-spec.test.ts` checks.

## What is not constrained, and why

- **Actor attribution** (`created_by_membership_id`, `updated_by_`,
  `assigned_by_`, `decided_by_`, `actor_membership_id`, ...). The server sets
  these from the session, never from an id the client sends; they may hold the
  system actor sentinel; and most sit on append-only history tables, where a
  restricting key would make the actor's membership impossible to remove.
- **Polymorphic references** (`bundle_items.ref_id`, `mentions.source_id`,
  `search_index_entries.source_id`, `storage_references.resource_id`, and
  similar `ref_id`/`source_id`/`target_id` columns): the parent table depends on
  another column, which a foreign key cannot express.
- **`automation_runs.automation_rule_id`**: rules are hard-deleted while their
  append-only run history is kept.

The coverage mappings were confirmed against real writes rather than column
names: a probe recorded, for every insert and update in the full test suite,
whether each referenced id was a parent of the same tenant. References the
suite never writes were included only where the parent is unambiguous.

## Deploying

Each part ships in two migrations:

- **120 / 122** add each parent's `(tenant_id, id)` key and the constraints
  `NOT VALID`. New writes are checked from this point; existing rows are not.
  Building the parent keys (13 in 120, 36 in 122) briefly blocks writes to
  those tables.
- **121 / 123** validate existing rows. They hold only a
  `SHARE UPDATE EXCLUSIVE` lock, so traffic continues while each table is
  scanned.

**Before deploying, run the integrity check against the target database** with
an owner/admin login that has complete RLS visibility:

```bash
TENANT_FK_INTEGRITY_DATABASE_URL=... pnpm db:tenant-fk:check
```

It lists every reference with rows that the validating migrations would
reject, split into missing parents and parents of another tenant, with sample
rows (by primary key; `a/b/c` for a composite key). It exits 0 only when there
are none. Resolve those rows first (they are data defects: each one is a
record pointing at nothing, or at another tenant), then deploy.

If a validating migration fails anyway, nothing is lost: the first stage keeps
protecting new writes. Run the check, resolve the rows it lists, and re-run the
deploy. After deploying, run the check again; it should report every
constraint `validated`.

## Deleting

`ON DELETE RESTRICT` everywhere. Most parents are soft-deleted (memberships,
courses, assessments, items, roles), never deleted (outbox events), or have
their children removed first. The parents that are hard-deleted release their
dependants in the same transaction:

| Deleting                                          | Dependants                                                   |
| ------------------------------------------------- | ------------------------------------------------------------ |
| marketing form                                    | submissions deleted; CTAs kept, `form_id` cleared            |
| marketing workflow                                | its runs and their logs deleted                              |
| competency dimension                              | refused while it has signals or scores; item weights deleted |
| batch                                             | live sessions kept, `batch_id` cleared                       |
| live session                                      | polls kept, `live_session_id` cleared                        |
| report destination                                | delivery records kept, `destination_id` cleared              |
| event, slider, webhook, newsfeed post, path steps | their children deleted first (unchanged)                     |

A delete that still hits a constraint fails with Postgres error `23503` naming
it: a bug to surface, not a case to cascade.

## Adding a reference

A new tenant table that references another tenant table gets the same
constraint, added `NOT VALID` and validated in a following migration, with the
parent's `(tenant_id, id)` key if it has none, the relation mirrored in
`schema.prisma` (`references: [tenant_id, id]`, `map:` the constraint name),
and an entry in `scripts/db/tenant-fk-spec.mjs`. If the parent is ever
hard-deleted, release the new dependants in the code that deletes it.
