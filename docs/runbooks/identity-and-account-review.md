# Identity and account review

Audit finding H6 (weak identity bootstrap). This runbook covers the rules that decide
which account a sign-in reaches, how operators review the cases those rules refuse,
and how to keep the hosted Supabase project aligned.

## The rules

An account (`auth_principals` row) is bound to one Supabase Auth user. The email
address alone never moves it.

| Sign-in situation                                                    | Result                                                                    |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| The Supabase user already owns an account                            | Signed in. Email and MFA state are refreshed only when they changed.      |
| The account is disabled                                              | Refused with `ACCOUNT_DISABLED`, at sign-in and on every later request.   |
| Email not confirmed in Supabase                                      | Refused with `EMAIL_NOT_VERIFIED`. Nothing is created or claimed.         |
| Confirmed email, no account uses it                                  | A new account is created.                                                 |
| Confirmed email matches an **unclaimed** placeholder                 | The placeholder is claimed, once.                                         |
| Confirmed email matches an account held by **another** Supabase user | Refused with `ACCOUNT_REVIEW_REQUIRED`, and a relink request is recorded. |

Unclaimed placeholders are created by the marketing integration sign-up API before
the learner has signed up. A placeholder that carries a platform grant is never
claimed by a sign-in; it goes to review instead.

A disabled account is also refused at every tenant's membership gate, and any
platform grant it holds confers nothing.

The database enforces the same boundary. Under the tenant roles (`atlas_app`,
`atlas_worker`) a trigger refuses any change of `supabase_user_id` or `global_status`
except claiming an unclaimed placeholder. The tenant roles may record relink
requests but cannot decide them.

## Passwords

- New passwords need at least 10 characters. Composition rules are deliberately
  absent: length plus the breach check rejects weak passwords without pushing people
  towards `Password1!`.
- Signup, password change, password reset and invitation set-password each check the
  password against Have I Been Pwned. Only the first five characters of its SHA-1
  hash leave the server, and responses are padded. If the lookup is unreachable the
  password is accepted on length alone and `auth.password_breach_check_unavailable`
  is logged; alert on a sustained rate of that event.
- `PASSWORD_BREACH_CHECK=off` disables the lookup. It defaults to off only in the
  test runtime, and deploy validation refuses `off` for the API and web.
- Sign-in still accepts older, shorter passwords until their owners change them.

## Reviewing a relink request (platform console → Accounts)

Requires `platform.identity.manage`, which only `super_admin` holds. Every action
asks for a reason; record the support ticket in it.

1. Confirm the person's identity through the support ticket, the same way you
   would for any account recovery.
2. In Supabase Auth, check the earlier user (the account's current sign-in). The
   API refuses to approve while that user still exists. If the earlier sign-in
   belongs to the same person, delete it in Supabase only once you are sure.
3. **Approve** moves the account to the new sign-in. The API checks again that the
   earlier Supabase user is gone and that the new one holds the same email,
   confirmed. Any platform role on the account is revoked; grant it again through
   the normal process if it is still needed. Other pending requests for the account
   are marked superseded.
4. **Reject** leaves the account where it is. The new sign-in stays refused.

Each decision writes `platform.identity.relink_approved` or
`platform.identity.relink_rejected` to the platform audit log.

## Disabling an account

Look the account up by email on the same screen and use **Disable account**. The
person is refused on their next request everywhere: every academy and the platform
console. **Enable account** reverses it. Operators cannot change their own account.
Each change writes `platform.identity.status_changed`.

## Hosted Supabase settings

`supabase/config.toml` only configures the local stack. Set these on the hosted
project and verify them before each production deploy:

Dashboard menu names move between Supabase releases, so the table gives the setting
name and the Management API field the check reads.

| Setting                         | API field                                           | Value                                                              |
| ------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------ |
| Confirm email                   | `mailer_autoconfirm`                                | `false` (confirmation required)                                    |
| Minimum password length         | `password_min_length`                               | `10` or more                                                       |
| Secure password change          | `security_update_password_require_reauthentication` | `true`                                                             |
| Prevent use of leaked passwords | `password_hibp_enabled`                             | `true` when the plan allows it (the application checks either way) |

```bash
SUPABASE_ACCESS_TOKEN=... SUPABASE_PROJECT_REF=... pnpm security:supabase-auth
```

The command exits non-zero if confirmations are off, the minimum is below 10, or
secure password change is off. Pass `-- --require-hibp` to fail on the leaked-password
setting too.

## Where auth emails and OAuth send people back

Signup, magic-link, resend and email-change emails, OAuth sign-in and identity
linking all carry a return URL that Supabase puts in the link or provider
redirect. The API accepts it only on the host the request came from: the
tenant domain (or platform host) the user is on, `https` only, with no
credentials or explicit port. Plain `http` and ports are allowed only on
development hostnames (`*.localhost`, `*.test`). Anything else is a 400 before
Supabase is called (`backend/packages/api/src/redirect-target.ts`). The web app
builds these URLs from its own origin, so real requests always pass.

Supabase's own redirect allow-list (Authentication → URL configuration) is a
second check. Keep it to the patterns your tenant domains need; a broad
wildcard there no longer opens a redirect, but it removes that second check.

## Deploying the migration

Migration `118_identity_bootstrap` marks existing placeholders `unclaimed`: on a
Supabase-hosted database, principals that never signed in and whose Supabase id
matches no `auth.users` row. Principals that ever signed in stay `active` even if
their Supabase user is gone, which is exactly the case that now goes to review.

Local development: confirmation emails land in the local mail catcher at
<http://127.0.0.1:54324>.
