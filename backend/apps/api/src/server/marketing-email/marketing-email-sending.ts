import { AtlasHttpError } from "@atlas/core/http/errors";

/**
 * Whether this deployment may send marketing email: email campaigns (sent,
 * scheduled or tested), the email touchpoints of multi-channel campaigns, and
 * marketing workflow email actions.
 *
 * Deployments turn it off with MARKETING_EMAIL_ENABLED=false while their SMTP
 * provider allows only transactional mail (ZeptoMail), because marketing mail
 * shares that SMTP setting. Login, notification, certificate and report email
 * are unaffected. Read at call time, like the certificate feature flags.
 */
export function isMarketingEmailEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env["MARKETING_EMAIL_ENABLED"] !== "false";
}

export const MARKETING_EMAIL_DISABLED_MESSAGE =
  "Marketing email is turned off on this platform, because its email provider allows only transactional mail. Login, notification and certificate emails still send.";

export function marketingEmailDisabledError() {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message: MARKETING_EMAIL_DISABLED_MESSAGE,
  });
}

export function assertMarketingEmailEnabled() {
  if (!isMarketingEmailEnabled()) throw marketingEmailDisabledError();
}
