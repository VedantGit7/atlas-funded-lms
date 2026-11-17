# Login security review — 16 November 2026 (launch plan 5.3)

A review of the sign-in flows built on Better Auth in launch plan tasks 3.2 to 3.6 ([design](better-auth-design.md)), before production is set up. It covered:

- password sign-in and sign-up;
- Google sign-in and linking;
- email sign-in links and email verification;
- password reset and change;
- two-factor (authenticator app and backup codes) and step-up;
- invitations;
- sessions, the session cache and cookies;
- the public auth routes' rate limits;
- the redirects after sign-in.

The code was read end to end, from the web pages through the API routes to Better Auth 1.7.14's own source where our code relies on its behaviour. Six problems were found and all six are fixed in the same pull request, with tests.

## Findings

| #   | Severity | Finding                                                                   |
| --- | -------- | ------------------------------------------------------------------------- |
| 1   | High     | An account created in someone else's name survives its owner verifying it |
| 2   | High     | Two-factor was skipped by Google and email sign-in links                  |
| 3   | Medium   | The session cache could be fooled by a planted cookie for up to a minute  |
| 4   | Medium   | Open redirect on the verify-email page and the confirm route              |
| 5   | Medium   | Rate limits were per IP only                                              |
| 6   | Low      | Sign-up answered faster for an address that already had an account        |

### 1. An account created in someone else's name survived its owner verifying it

**What happened.** Sign-up took a password and created the account unverified, then emailed a verification link. Anyone could sign up with someone else's address and a password of their own choosing. When the real owner later came:

- their own sign-up was silently skipped, because the address was taken, and they got no email;
- so they asked to resend the verification email, or used an email sign-in link;
- either link verified the address and signed them in, and the attacker's password still worked on the account.

For a placeholder made before its owner signed up (an invitation, audit H6) it was worse:

- the first password typed at sign-up was kept;
- the owner's own sign-up password was ignored;
- the owner then received a normal "confirm your email" message for the sign-up they had just made.

The same applied to a Google account whose address Google hadn't verified: Better Auth created the account unverified, with that Google login attached.

**Fix: the address is proven before anything is chosen for the account.**

- The sign-up form asks for the name and email only. The emailed link opens `/signup/complete`, where the password is chosen, and only then is the account created, already verified, and signed in.
- The link carries a random token. Only its SHA-256 hash is stored, the link works once, and it expires after 24 hours.
- A sign-up for an address that already has an account emails its owner saying so, with a way to sign in. A disabled account is sent nothing. The answer on screen is the same for every address.
- Better Auth may no longer create an unverified account: the user create hook refuses it. A Google address Google hasn't verified gets no account, and Better Auth's own sign-up verification links are refused when opened.
- When an address is proven for an account that wasn't yet proven, by finishing a sign-up or accepting an invitation, every login method and session that account had is removed first. This covers accounts left from before the fix.
- Email sign-in links are sent only to verified accounts.

### 2. Two-factor was skipped by Google and email sign-in links

**What happened.** A password sign-in for an account with an authenticator gets no session until the code is entered. Google and email sign-in links, though, create an `aal1` session straight away.

- The server accepted that session on every route except the 26 that declare two-factor (the admin and billing ones).
- The Google callback didn't even send the person to the code screen.

So the inbox alone, or the Google account alone, was enough to use the app, change the account's email, and link another login method.

**Fix.**

- `requireSessionUser` treats a session of an account with an authenticator as not signed in until it has passed the second factor (`aal2`). It answers `MFA_REQUIRED` on every route except the two the code step needs, which declare `mfa: "challenge"`: the step-up route and the list of the account's own authenticators that the code dialog reads first.
- The Google callback and the email-link confirm route now send such a person to the sign-in page's code step (`/login?step=mfa`).
- The learner and admin shells redirect there on `MFA_REQUIRED`, and the browser's API client already opens its code dialog on it.

### 3. The session cache could be fooled by a planted cookie

**What happened.** To save database reads, each API process remembers a verified session for 60 seconds, keyed on the session cookie's value.

- The key came from whichever session cookie came first in the request: the plain `atlas_session` or the `__Secure-atlas_session` that Better Auth actually reads on https.
- If someone could plant a plain `atlas_session` cookie in a victim's browser, Better Auth verified the victim's real cookie, and the answer was remembered under the planted value.
- The attacker could then send the planted value alone and be the victim for up to a minute.

Planting the cookie takes control of a sibling site under the same parent domain. Later it would also be possible from an academy's own tracking snippet, if academies share a base domain.

**Fix.**

- The cache reads only the cookie name Better Auth reads (`__Secure-atlas_session` on https, `atlas_session` locally).
- It checks that Better Auth's answer is for that same session token before remembering it.

### 4. Open redirect on the verify-email page and the confirm route

**What happened.**

- `https://<academy>/verify-email?status=success&next=/%5Cevil.example` showed "You're all set", then sent the browser to `evil.example`. That's useful for phishing, under the academy's own name.
- The page's check refused `//` but not `/\`, which browsers and URL parsing read as `//`. The `/auth/confirm` route had the same check.

**Fix.** Both pages, and the screen that performs the redirect, now use the shared `resolveSafeRedirectPath`, which already refused backslashes and `://`.

### 5. Rate limits were per IP only

**What happened.** The public auth routes shared one budget of 20 requests a minute per client IP. That caused three problems:

- one account's password could be guessed from many addresses without limit;
- anyone could have the academy send sign-in, reset or verification emails to any address, 20 a minute per IP, costing email credits and sending reputation;
- a class signing in behind one connection hit the limit quickly.

**Fix.** Each email address now has its own budgets over 15 minutes, whatever IP the requests come from ([rate limiting](../runbooks/rate-limiting.md)):

- 10 password attempts;
- 3 of each kind of email: sign-up link, sign-in link, password reset.

They count requests for any address, with or without an account, so a refusal reveals nothing. The per-IP budget is raised from 20 to 60 a minute.

### 6. Sign-up answered faster for an existing address

**What happened.** A sign-up for a new address hashed the password and created the account; one for an existing address returned at once. The difference in response time told an attacker whether an address had an account.

**Fix.** Sign-up no longer takes a password. Every address now gets the same work, a lookup and one email, except a disabled account, which is sent nothing.

## Checked and fine

- **Guessing a second-factor code.** Better Auth caps attempts per sign-in challenge and locks the account's authenticator for 15 minutes after 10 wrong codes. The step-up and enrolment routes have their own budget of 10 per 15 minutes per account.
- **Google sign-in state.** The state is tied to a signed cookie in the browser that started it. A Google callback forged by someone else, whether a sign-in or an account link, fails.
- **Invitations.** They take the address from the invitation record, never from the request.
- **The academy host header.** The web proxy deletes any client-sent copy and sets its own, and the API isn't reachable from outside. Email links therefore always point at a configured academy host.
- **Password reset.** It ends every session and starts none; an account with an authenticator still needs its code at the next sign-in.
- **Email sign-in links.** They are stored hashed, expire in 10 minutes and work once.
- **Account changes.**
  - Changing the email needs approval from the current address, then verification of the new one.
  - Removing the authenticator needs a session that passed it.
  - The platform console needs two-factor for every request.
- **Disabled accounts.** A disabled account is refused on its next request, because its status is read on every request.
- **Cookies.**
  - They are `HttpOnly`, `SameSite=Lax`, and `Secure` with the `__Secure-` prefix on https.
  - HSTS covers the academy host and its subdomains.

## Kept as designed

- **The 60-second session cache.** A sign-out, password reset or "sign out other sessions" takes up to a minute to reach every API process. Disabling an account is still immediate. This was decided in audit §3.1 for the load it saves.
- **Lockout by a guesser.** Someone guessing a password can hold its owner's password sign-in for 15 minutes; Google and sign-in links still work. The same is true of the authenticator lockout, which only someone with the password can trigger.

## Tests

- **Unit** (`tests/unit/auth/login-security-review.test.ts` and others):
  - the session cookie name and planted-cookie handling;
  - the second-factor rule;
  - the per-address budgets;
  - the new emails and their links;
  - the backslash redirect;
  - that the redirect pages use the shared check;
  - the tenant route wrapper's handling of a session waiting for its code.
- **Integration**, against PostgreSQL (`tests/integration/auth`):
  - sign-up through the emailed link, which stores only the token's hash and works once;
  - an existing address gets an "account exists" email and keeps its password;
  - an unproven account loses its old password when its owner finishes signing up;
  - Better Auth refuses an unverified account, and Google creates nothing for an unverified address;
  - a planted cookie never authenticates;
  - a session from an email link is refused until its code is given.
- **Browser journey J01.** The sign-up form has no password field, and the completion page asks for one.
