# Platform operator access, revocation, and recovery

F02 makes active `platform_operators` rows the sole source of platform permissions. F01 still requires current-session AAL2. `PLATFORM_OPERATOR_ASSIGNMENTS` is retired: remove it from deployment secrets/configuration once rollout is verified. Its presence no longer grants access.

## Normal authorization

- A request reads the active database grant every time. No active grant means no platform permissions; a database error does not fall back to configuration.
- Revoke a grant by setting `revoked_at`, `revoked_by_principal_id` and `revoke_reason`, and updating `updated_at`. Keep the row. A future approved re-grant is a **new row** with its own grantor, reason and timestamp.
- Platform access does not grant a tenant membership or tenant role. Use the tenant's explicit membership/role workflow for a person who needs tenant access. Revoking a platform grant does not remove independently approved tenant access; revoke those grants separately when offboarding a person.
- Login, ordinary API requests, downloads and SCORM access never recreate tenant-admin access. A suspended/removed membership and a removed role remain denied.
- Existing support-session records do not become authentication tokens or implicit tenant-admin grants. Do not bypass tenant authorization by treating an audit record as permission.

## First operator bootstrap

Before deploying this change, review the existing operator list and confirm that every approved operator already has an active database grant. Do not bulk-import old environment assignments or restore revoked identities. If the grant table has never contained an operator, use the initial bootstrap procedure below; otherwise use reviewed recovery. This preflight prevents unintended lockout when retiring the fallback.

This is a maintenance operation by the authorized database administrator, not an application HTTP endpoint. Use a reviewed change/incident record, the correct environment and a privileged maintenance connection. First create/verify the person's auth identity through the normal account flow; obtain its `auth_principals.id`. MFA enrollment and a completed challenge are still required to use the platform after the grant.

The following **psql** procedure asks for a principal UUID and a change reference. It refuses to run if any operator history exists, including revoked rows, so rerunning bootstrap cannot undo revocation. It creates no tenant roles or memberships. Do not run it with an application service credential.

```sql
\set ON_ERROR_STOP on
\prompt 'Verified auth principal UUID: ' bootstrap_principal
\prompt 'Approved change reference and reason (at least 10 characters): ' bootstrap_reason
BEGIN;
LOCK TABLE platform_operators IN SHARE ROW EXCLUSIVE MODE;
SELECT set_config('atlas.bootstrap.principal', :'bootstrap_principal', true);
SELECT set_config('atlas.bootstrap.reason', :'bootstrap_reason', true);
DO $$
DECLARE
  principal_id uuid := current_setting('atlas.bootstrap.principal')::uuid;
  reason text := trim(current_setting('atlas.bootstrap.reason'));
BEGIN
  IF EXISTS (SELECT 1 FROM platform_operators) THEN
    RAISE EXCEPTION 'Operator history exists; use reviewed recovery, not bootstrap';
  END IF;
  IF length(reason) < 10 THEN
    RAISE EXCEPTION 'An approved change reference and reason are required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM auth_principals WHERE id = principal_id AND global_status = 'active'
  ) THEN
    RAISE EXCEPTION 'An existing active principal is required';
  END IF;
  INSERT INTO platform_operators (
    auth_principal_id, role_key, granted_by_principal_id, grant_reason
  ) VALUES (
    principal_id, 'super_admin', NULL, 'Initial DBA bootstrap: ' || reason
  );
END $$;
COMMIT;
```

The initial grantor is null because no application operator exists yet; the executing DBA and approval must be retained in the maintenance change record. Do not claim that a direct SQL change was written through the application's audit hash chain.

### On a fresh environment

A new environment has no tenant, so the first operator gets an account, a grant and MFA without one.

1. **Create the sign-in.** In the environment's Supabase project, open **Authentication → Users → Add user → Create new user**. Enter the operator's email and a strong password, and tick **Auto Confirm User**.
2. **Sign in on the platform host** (`https://<PLATFORM_HOST>/login`). The sign-in records the account in `auth_principals`. The console then answers "Platform access denied", because there is no grant yet.
3. **Grant it.** As the database owner, find the principal and run the bootstrap above with its id. On Coolify, the owner's URL is in `/root/atlas/<env>/migrate.env` ("Databases and migrations" in `coolify-deployment.md`):

   ```bash
   ENV=staging
   docker run --rm -it --network atlas-$ENV \
     -v /data/coolify/ssl/coolify-ca.crt:/ca.crt:ro -e PGSSLROOTCERT=/ca.crt \
     --env-file /root/atlas/$ENV/migrate.env \
     postgres:16-alpine sh -c 'psql "$DATABASE_URL"'
   ```

   ```sql
   SELECT id, global_status FROM auth_principals WHERE email_normalized = lower('<email>');
   ```

4. **Set up MFA in the console.** Reload `https://<PLATFORM_HOST>/platform`. With a grant but no verified factor, the console shows **Set up multi-factor authentication**: scan the code, enter the 6-digit code, then continue. Verifying the factor completes MFA for that session.

   The platform's enrollment routes (`/api/v1/platform/me/security/mfa`) are the only platform routes that accept a password-only session, and only while the operator has no verified factor (route metadata `mfa: "enrollment"`). After that they need aal2 like every other platform route, so a stolen password cannot add a factor.

5. **Create the first tenant** in the console (**Provision**, `/platform/tenants/new`), with the owner's email. Provisioning creates the owner's invitation, carrying the `owner` role, but does not send it: a new tenant has no live domain to link to yet.
6. **Invite the owner** once the tenant's primary domain is active: open the tenant, then **Lifecycle → Send owner invitation**, with a reason. The owner gets an email (Supabase's invitation, or a sign-in link for an existing account) that opens `https://<primary domain>/invite/accept`. Sending again replaces the link. The action refuses while the tenant is not active, has no active primary domain (or only a local one outside development), or has no pending owner invitation.

## Recovery when operator history exists

There is no environment bypass or temporary emergency-access feature. First determine whether the revocation was intentional. An authorized DBA may create a new, narrowly scoped database grant after a recorded review of identity, reason, role and environment. Retain all revoked rows; never clear their revocation fields, and never reinstate every address from old deployment configuration. Record the executing administrator in the maintenance log and `granted_by_principal_id` when an application principal represents that administrator.

If access is granted only for an incident, name a responsible owner and an explicit revocation deadline in the incident record; the current schema does **not** enforce expiry automatically. Revoke that incident grant after restoring normal administration and verify denial using the same authenticated account. F01 applies to recovered access too; recovery must not bypass MFA.

## Review legacy automatically created tenant access before rollout

The removed helper did not store membership/role provenance, and its platform-scope audit record did not reliably include the affected tenant. Consequently, matching a system-assigned admin role is a **review candidate**, not proof it was created by the helper. Do not bulk-delete these roles or revoke legitimate tenant administrators by inference.

1. Export the former configured operator identities into a restricted review record. Do not put their addresses in source control. Include former operators from grant history and the audit query below.
2. Run the following read-only inventory with an authorized maintenance connection. Review all candidate tenant admin roles against tenant-owner approvals. The audit predicate identifies historical helper use for a principal, not the exact tenant affected.

```sql
WITH candidate_principals AS (
  SELECT auth_principal_id AS id FROM platform_operators
  UNION
  SELECT actor_principal_id AS id
  FROM audit_entries
  WHERE metadata_json->>'route' = 'auth.platform-super-admin.tenant-access'
    AND actor_principal_id IS NOT NULL
)
SELECT p.id AS principal_id, m.tenant_id, m.id AS membership_id,
       m.status, r.key AS tenant_role, ur.created_at AS assigned_at,
       ur.assigned_by_membership_id
FROM candidate_principals c
JOIN auth_principals p ON p.id = c.id
JOIN memberships m ON m.auth_principal_id = p.id
JOIN user_roles ur ON ur.tenant_id = m.tenant_id AND ur.membership_id = m.id
JOIN roles r ON r.tenant_id = ur.tenant_id AND r.id = ur.role_id
WHERE r.key IN ('owner', 'admin') AND r.deleted_at IS NULL
ORDER BY p.id, m.tenant_id;
```

3. Also inventory explicitly known former environment-only principals if audit retention is incomplete; the query above is not exhaustive without those records.
4. Revoke unapproved tenant roles through the audited tenant workflow, or suspend/remove memberships when all tenant access should end. Preserve approved independent grants. Record every disposition.
5. Verify a revoked platform account receives a platform denial even with stale deployment configuration. Verify suspended/removed tenant memberships and removed admin roles remain denied after login, retry, direct API requests and downloads.

This code change does not retroactively remove legacy memberships. Completing the inventory/revocation review is a rollout gate; do not claim that all historical elevated access has been revoked solely because the patch is deployed.

## Browser test fixtures

`scripts/e2e/seed-browser-users.mjs` explicitly creates a database grant for a new platform fixture. It reuses a matching active grant but refuses to resurrect a revoked grant or override a different active role. Grant checks and insertion are serialized in a database transaction. Run this script only for the designated test environment; it is not production recovery tooling. It no longer emits an environment-based platform grant. A database grant alone does not satisfy F01's MFA requirement for browser journeys.

## Grants and account changes (audit H6)

A grant belongs to an account, not to an email address. A sign-in never carries a grant to a different Supabase user: approving a relink in the platform console revokes the account's grant, and a disabled account's grant confers nothing while it stays disabled. See [identity and account review](identity-and-account-review.md).
