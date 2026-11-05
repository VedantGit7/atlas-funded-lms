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

## Sign-in emails

Verification, sign-in links, password resets, email changes and invitations are
not templates here: the API builds them in one academy-branded layout
(`backend/apps/api/src/lib/auth-email.ts`; docs/engineering/better-auth-design.md,
"Task 3.6") and sends each from the academy it was asked on.

## Security notification templates (custom transactional)

These are sent from application code when a sensitive account change occurs. The `Secure my account` button links to
`{{ .SiteURL }}/reset-password`; swap `{{ .SiteURL }}` / `{{ .Email }}` for whatever your
sender substitutes.

| File                                  | Suggested subject                                       |
| ------------------------------------- | ------------------------------------------------------- |
| `security-password-changed.html`      | Your FundedBeyond Academy password was changed          |
| `security-email-changed.html`         | Your FundedBeyond Academy email address was changed     |
| `security-phone-changed.html`         | Your FundedBeyond Academy phone number was changed      |
| `security-signin-method-linked.html`  | A new sign-in method was added to your account          |
| `security-signin-method-removed.html` | A sign-in method was removed from your account          |
| `security-mfa-method-added.html`      | Two-factor authentication was added to your account     |
| `security-mfa-method-removed.html`    | Two-factor authentication was removed from your account |

## Application wiring status

| Template / feature                        | Wired in app code                                                          |
| ----------------------------------------- | -------------------------------------------------------------------------- |
| Sign-in emails                            | Built and sent by the API (`lib/auth-email.ts`)                            |
| Security alert emails (`security-*.html`) | Dispatched via notification worker when account-security routes succeed    |
| User toggles for alerts                   | `PUT /api/v1/me/preferences` persists to `member_notification_preferences` |
| Account security UI                       | `/settings` → Account security section                                     |

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
