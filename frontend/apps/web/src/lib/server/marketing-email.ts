/**
 * Whether this deployment sends marketing email; the API enforces it
 * (backend/apps/api/src/server/marketing-email/marketing-email-sending.ts).
 * The web reads the same MARKETING_EMAIL_ENABLED setting only to hide the
 * screens that would send it. Read at request time, so a redeploy with a new
 * value needs no rebuild.
 */
export function isMarketingEmailEnabled(): boolean {
  return process.env["MARKETING_EMAIL_ENABLED"] !== "false";
}

export const MARKETING_EMAIL_OFF_MESSAGE =
  "Email campaigns are turned off on this platform, because its email provider allows only transactional mail. Login, notification and certificate emails still send.";
