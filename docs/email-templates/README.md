# Email templates

Branded HTML email templates for FundedBeyond Academy. Each file is a complete,
standalone HTML document with inline styles and table-based layout for broad email
client compatibility (Gmail, Apple Mail, Outlook via VML fallbacks, mobile).

Design system (shared across all templates):

- Navy header band `#1B2A4A` with the `FundedBeyond Academy` wordmark
- Accent blue `#3D7BF0` for primary CTAs and links
- Light page background `#eef1f8`, white card with rounded corners
- Body copy `#475569`, headings `#0F172A`, muted notes `#94a3b8`
- `Segoe UI` system font stack; monospace only for OTP codes

## Supabase Auth templates

Paste these into **Supabase Dashboard → Authentication → Emails → Templates**.
They use Supabase Go-template variables (e.g. `{{ .ConfirmationURL }}`).

| File | Supabase template | Suggested subject | Key variables |
| --- | --- | --- | --- |
| `confirm-signup.html` | Confirm signup | Confirm your email to activate your FundedBeyond Academy account | `{{ .ConfirmationURL }}`, `{{ .Data.display_name }}` |
| `reset-password.html` | Reset password | Reset your FundedBeyond Academy password | `{{ .ConfirmationURL }}`, `{{ .Data.display_name }}` |
| `magic-link.html` | Magic link | Your FundedBeyond Academy sign-in link | `{{ .ConfirmationURL }}`, `{{ .Data.display_name }}` |
| `invite-user.html` | Invite user | You've been invited to FundedBeyond Academy | `{{ .ConfirmationURL }}` |
| `change-email-address.html` | Change email address | Confirm your new email address | `{{ .ConfirmationURL }}`, `{{ .Email }}`, `{{ .NewEmail }}` |
| `reauthentication.html` | Reauthentication | Your FundedBeyond Academy verification code | `{{ .Token }}` (6-digit OTP, no link) |

## Security notification templates (custom transactional)

These are **not** built-in Supabase templates — they're sent from custom application
code when a sensitive account change occurs. The `Secure my account` button links to
`{{ .SiteURL }}/reset-password`; swap `{{ .SiteURL }}` / `{{ .Email }}` for whatever your
sender substitutes.

| File | Suggested subject |
| --- | --- |
| `security-password-changed.html` | Your FundedBeyond Academy password was changed |
| `security-email-changed.html` | Your FundedBeyond Academy email address was changed |
| `security-phone-changed.html` | Your FundedBeyond Academy phone number was changed |
| `security-signin-method-linked.html` | A new sign-in method was added to your account |
| `security-signin-method-removed.html` | A sign-in method was removed from your account |
| `security-mfa-method-added.html` | Two-factor authentication was added to your account |
| `security-mfa-method-removed.html` | Two-factor authentication was removed from your account |

## Supabase dashboard configuration

Paste the HTML templates from this folder into **Supabase Dashboard → Authentication → Emails**.

Also enable in Supabase Auth settings:

- **TOTP MFA** — required for `/api/v1/me/security/mfa` enrollment
- **Manual identity linking** — required for connected accounts link/unlink
- **Secure email change** — recommended when using change-email API
- **SMS provider** — required for phone change (`/api/v1/me/security/phone`)
- **Redirect URLs** — add each tenant origin plus `/auth/confirm` for magic link and email flows

## Application wiring status

| Template / feature | Wired in app code |
| --- | --- |
| Confirm signup, reset password, magic link | Supabase sends email; app handles redirect/session |
| Security alert emails (`security-*.html`) | Dispatched via notification worker when account-security routes succeed |
| User toggles for alerts | `PUT /api/v1/me/preferences` persists to `member_notification_preferences` |
| Account security UI | `/settings` → Account security section |

## Environment

- `NOTIFICATION_EMAIL_PROVIDER=mock` — logs security/product emails in dev (no real send)
- Configure a transactional provider before production email delivery
- `PUBLIC_SITE_URL` — fallback site URL for security email buttons when tenant domain is unknown

## Notes

- The wordmark is rendered as styled text (no image) so it always displays even when
  images are blocked. To swap in a hosted PNG logo later, replace the wordmark `<td>`
  in the header band of each file — use a PNG/JPG (SVG is unsupported in most email
  clients) hosted on a public HTTPS URL.
- Preview rendering after any edit with a tool like [Litmus](https://litmus.com) or
  [Email on Acid](https://www.emailonacid.com) before shipping.

