# F19 — Supabase security findings

Updated 20 September 2026. **The database permission findings are fixed on the connected hosted project. Leaked-password protection remains blocked by the organization's Free plan. F19 is partially complete.**

## Hosted result

Project: `atlas-funded-lms` / `rolumnldqjelwfvtmmqf`, organization `uoubdxyhutdqsngtsoxz`.

| Check                                           | Before                        | After                                    |
| ----------------------------------------------- | ----------------------------- | ---------------------------------------- |
| Anonymous EXECUTE on `public.rls_auto_enable()` | Allowed                       | Denied                                   |
| Authenticated EXECUTE                           | Allowed                       | Denied                                   |
| PUBLIC EXECUTE inheritance                      | Allowed                       | Removed                                  |
| Owner and service-role EXECUTE                  | Allowed                       | Preserved                                |
| Function return type                            | `event_trigger`               | Unchanged                                |
| Function owner / security mode                  | `postgres` / SECURITY DEFINER | Unchanged                                |
| Function search path                            | `pg_catalog`                  | Unchanged                                |
| Function definition                             | Captured before change        | Exact comparison unchanged               |
| `ensure_rls` event trigger                      | Enabled (`O`)                 | Enabled, same event and tags             |
| Security advisor findings                       | Three warnings                | One: leaked-password protection disabled |
| Performance advisor findings                    | None                          | None                                     |
| Public application tables                       | Zero                          | Zero                                     |

Applied migration: `20260920145340_harden_rls_auto_enable_execute`. The local migration filename matches the version returned by the hosted migration history. It was initially created using the official Supabase CLI; the remote migration tool assigned the final recorded version.

The migration revokes only EXECUTE on the named function from `PUBLIC`, `anon` and `authenticated`. Revoking only the two named client roles would leave PUBLIC inheritance intact. It preserves the function and trigger definitions and does not change table policies, global default privileges, accounts or LMS data. It safely skips a fresh local auth stack where the optional helper is absent, rejects an unexpected return type, and fails if client roles still inherit access through another role.

This is a privilege cleanup, not evidence that the original advisory represented a working anonymous privilege-escalation exploit. PostgreSQL event-trigger functions are special functions invoked by the event-trigger mechanism; the audited helper is not an ordinary data-returning RPC. Its SECURITY DEFINER setting was retained so its existing automatic RLS behavior remains intact. [PostgreSQL event trigger behavior](https://www.postgresql.org/docs/17/event-trigger-definition.html), [Supabase anonymous EXECUTE advisory](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [authenticated EXECUTE advisory](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

## Verification and recurrence protection

The exact captured function was recreated on a disposable PostgreSQL 17 database before the hosted change. The regression check failed with the original grants, then passed with the migration. It verifies:

- Both client roles and an ordinary role inheriting PUBLIC cannot execute the function.
- Direct anonymous/authenticated calls fail with insufficient privilege.
- Owner and service-role access remains available.
- The function definition remains identical and rerunning the migration is safe.
- An ordinary DDL role without function EXECUTE still gets automatic RLS for CREATE TABLE, CREATE TABLE AS, SELECT INTO and a partitioned table.
- A missing optional helper is safe, while an unrelated function with the same name is rejected.
- All fixture roles, functions, triggers and tables roll back after the test.

The repeatable check is `pnpm test:supabase-security`. Its connection targets only `127.0.0.1:15439/atlas_f19_verification`, asserts PostgreSQL 17 and database identity, and never reads application database URLs or dotenv files. CI runs it against a dedicated disposable PostgreSQL service. The SQL-path guard now also scans Supabase migrations, separately from the LMS's Prisma migrations.

After the hosted migration, fresh catalog queries confirmed effective privileges, unchanged definition and trigger binding. Fresh security advisors no longer report either function-permission warning. These checks establish the hosted ACL result; the four DDL behavior cases were exercised in isolation, without creating test tables in the hosted database.

Local lint and SQL-location checks passed. The structural suite passed **442 tests**, with one existing optional PDF-worker test skipped. No application authentication behavior or frontend code was changed, so an application rebuild was not needed. The disposable PostgreSQL container was stopped after validation. GitHub CI itself has not been run for these uncommitted changes.

Evidence: [before snapshot](audits/2026-09-20/f19-function-before.json), [hosted verification](audits/2026-09-20/f19-verification.json).

## Remaining password-protection requirement

The connected organization reports plan **`free`**. Supabase documents leaked-password protection as available on **Pro and above**. The live advisor still reports it disabled. No subscription was upgraded, no billing change was made, and no user's password was changed. [Supabase password security and plan requirement](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

After the organization is on an eligible plan:

1. Enable leaked-password protection in this project's [Email provider settings](https://supabase.com/dashboard/project/rolumnldqjelwfvtmmqf/auth/providers?provider=Email).
2. Verify rejection of a known breached test password on signup and password change, and acceptance of a freshly generated strong password, using a disposable identity and controlled test inbox. Do not alter a real user's password or treat mocked errors as proof of provider enforcement.
3. Re-run the security advisor and save evidence that the warning cleared. Check Atlas presents a useful rejection message in signup, recovery, invitation and account password-change flows.

Provider enforcement and its end-to-end password behavior **have not been demonstrated** because the prerequisite feature is unavailable on the current plan. A frontend-only password check would be bypassable through the public Auth API and is not a substitute. This plan-dependent part remains open.

The Supabase public schema still has no LMS tables. These advisor results apply to the connected Supabase project and do not certify the separate application database's RLS or grants.
