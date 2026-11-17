# Identity and account review

Audit finding H6 (weak identity bootstrap). This runbook covers the rules that decide
which account a sign-in reaches, and how operators disable and re-enable accounts.

## The rules

An account (`auth_principals` row) is Better Auth's user: one row per person, signed in
by any of its login methods (a password, Google, an email link), with an authenticator
if it has one (docs/engineering/better-auth-design.md). The email address alone never
moves it.

| Sign-in situation                                                    | Result                                                                                                                                  |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| An active account signs in with one of its login methods             | Signed in.                                                                                                                              |
| The account is disabled                                              | Refused with `ACCOUNT_DISABLED`, at sign-in and on every later request.                                                                 |
| The address has not been verified                                    | Refused with `EMAIL_NOT_VERIFIED`. Nothing is signed in. Only accounts from before the November 2026 security review can be unverified. |
| A new address signs up                                               | Nothing is created until its owner opens the emailed link and chooses a password; the account is then created verified and signed in.   |
| Someone finishes sign-up for an unverified account or a placeholder  | The emailed link proved the address, so the account becomes theirs: every login method and session it had is removed first.             |
| A sign-up for an address that already has an account                 | Its owner is emailed that the account exists. The answer on screen is the same as for a new address.                                    |
| A verified address matches an **unclaimed** placeholder              | The placeholder is claimed at that first sign-in, once.                                                                                 |
| Google sign-in for an address that already has an account            | Refused with `ACCOUNT_NOT_LINKED` unless both sides verified it.                                                                        |
| Google sign-in for an address Google hasn't verified                 | No account is created; the person signs up by email.                                                                                    |
| An account with an authenticator signs in by Google or an email link | Signed in only once the authenticator code is given; until then every request but the code step answers `MFA_REQUIRED`.                 |

Unclaimed placeholders are created by the marketing integration sign-up API before
the learner has signed up. A placeholder that carries a platform grant is never
claimed by a sign-in.

A disabled account is also refused at every tenant's membership gate, and any
platform grant it holds confers nothing.

The database enforces the same boundary. Under the tenant roles (`atlas_app`,
`atlas_worker`) and Better Auth's own role (`atlas_auth`), a trigger refuses any change
of `global_status` except claiming an unclaimed placeholder, and refuses creating an
account in any state but active or unclaimed. Only the platform plane disables or
re-enables an account.

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
- The minimum, email verification and the other login settings are Better Auth's
  configuration in code (`backend/packages/auth/src/better-auth.ts`), so they can't
  drift from a dashboard.

## Disabling an account (platform console → Accounts)

Requires `platform.identity.manage`, which only `super_admin` holds. Every action
asks for a reason; record the support ticket in it.

Look the account up by email and use **Disable account**. The person is refused on
their next request everywhere: every academy and the platform console. **Enable
account** reverses it. Operators cannot change their own account. Each change writes
`platform.identity.status_changed` to the platform audit log.

## Where auth emails send people back

Sign-up, sign-in, password-reset, email-change and invitation links are built by
the API from the host the request came to, so they always lead back to the academy
(or the platform console) the person was on (`backend/apps/api/src/lib/auth-email.ts`).
A client can't name a return address: the requests have no field for one. Google
returns people to `/auth/callback/google` on the same host, the address registered on
the Google clients.

## The November 2026 security review

The sign-up, two-factor and session rules above came from the login security review
(launch plan 5.3), which also added per-address rate limits on the sign-in routes and made
a sign-out end the session in every API process at once
([review](../engineering/login-security-review-2026-11-16.md),
[rate limiting](rate-limiting.md)).

## Migrations

- `118_identity_bootstrap` added `unclaimed` placeholders and the database guard.
- `129_drop_supabase_identity` removed the Supabase user id, the relink requests and
  the guard's rule for them (launch plan task 3.8). It also cleared `mfa_enabled` for
  accounts with no Better Auth authenticator, which set one up again at their next
  sign-in.
