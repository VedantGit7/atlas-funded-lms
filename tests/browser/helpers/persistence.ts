import pg from "pg";
import { assertIsolatedFixtureTarget } from "../../../scripts/e2e/isolated-target.mjs";
import { requiredCredential } from "./env";

/** Inspect only the tenant just created by the browser, without reading invite secrets. */
export async function provisionedTenantPersistence(tenantId: string) {
  const databaseUrl = requiredCredential("E2E_OWNER_DATABASE_URL");
  const authUrl = process.env["SUPABASE_URL"] ?? requiredCredential("NEXT_PUBLIC_SUPABASE_URL");
  assertIsolatedFixtureTarget({ databaseUrl, authUrl });
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query("BEGIN READ ONLY");
    const invitations = await client.query<{ status: string; email: string }>(
      "SELECT status::text, invited_email_normalized AS email FROM memberships WHERE tenant_id = $1::uuid AND status = 'INVITED' ORDER BY created_at",
      [tenantId],
    );
    const roles = await client.query<{ key: string; permission_count: number }>(
      "SELECT r.key, count(rp.id)::int AS permission_count FROM roles r LEFT JOIN role_permissions rp ON rp.tenant_id = r.tenant_id AND rp.role_id = r.id WHERE r.tenant_id = $1::uuid AND r.deleted_at IS NULL AND r.is_system = true GROUP BY r.id, r.key ORDER BY r.key",
      [tenantId],
    );
    const audit = await client.query<{ action: string; reason: string; request_id: string }>(
      "SELECT action, metadata_json->>'reason' AS reason, request_id FROM audit_entries WHERE tenant_id = $1::uuid AND target_id = $1::text AND action IN ('tenant.created', 'tenant.state_changed') ORDER BY occurred_at",
      [tenantId],
    );
    return { invitations: invitations.rows, roles: roles.rows, audit: audit.rows };
  } finally {
    try {
      await client.query("ROLLBACK");
    } finally {
      await client.end();
    }
  }
}

/** Fixed, parameterized, read-only queries against the disposable fixture database. */
export async function foreignPersistenceSnapshot(
  tenantId: string,
  courseId: string,
  certificateId: string,
) {
  const databaseUrl = requiredCredential("E2E_OWNER_DATABASE_URL");
  const authUrl = process.env["SUPABASE_URL"] ?? requiredCredential("NEXT_PUBLIC_SUPABASE_URL");
  assertIsolatedFixtureTarget({ databaseUrl, authUrl });
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query("BEGIN READ ONLY");
    const course = await client.query<{ snapshot: unknown }>(
      "SELECT to_jsonb(c) AS snapshot FROM courses c WHERE tenant_id = $1::uuid AND id = $2::uuid",
      [tenantId, courseId],
    );
    const certificate = await client.query<{ snapshot: unknown }>(
      "SELECT to_jsonb(c) AS snapshot FROM certificates c WHERE tenant_id = $1::uuid AND id = $2::uuid",
      [tenantId, certificateId],
    );
    if (course.rowCount !== 1 || certificate.rowCount !== 1)
      throw new Error("Foreign browser sentinels must exist before isolation assertions.");
    return { course: course.rows[0]?.snapshot, certificate: certificate.rows[0]?.snapshot };
  } finally {
    try {
      await client.query("ROLLBACK");
    } finally {
      await client.end();
    }
  }
}
