import type { Client } from "pg";

/**
 * Removes one Better Auth test file's rows: its principals (with their
 * sessions, login methods and authenticators, which cascade) and the short-lived
 * verification values that belong to them.
 *
 * Only this file's values: the Better Auth suites run in parallel against one
 * database, and deleting every value created since a file started removed
 * another file's pending two-factor challenge mid-test. A value names its
 * principal's id (password reset, two-factor challenge) or carries its email
 * (sign-in link); anything else expires on its own within minutes.
 */
export async function removeBetterAuthTestRows(owner: Client, emailPrefix: string): Promise<void> {
  const { rows } = await owner.query<{ id: string }>(
    "select id::text from auth_principals where email_normalized like $1",
    [`${emailPrefix}%`],
  );
  const ids = rows.map((row) => row.id);
  await owner.query(
    "delete from auth_verifications where value = any($1::text[]) or value like $2",
    [ids, `%${emailPrefix}%`],
  );
  await owner.query("delete from auth_principals where email_normalized like $1", [
    `${emailPrefix}%`,
  ]);
}
