import { createTransport, type Transporter } from "nodemailer";

/**
 * Email delivery.
 *
 * Audit finding C7: this module previously had NO real transport. The only
 * "working" implementation required `NOTIFICATION_EMAIL_PROVIDER=mock` and then
 * logged a line and returned; anything else threw. No email library was
 * installed anywhere in the monorepo. Production therefore had two possible
 * states — emails silently discarded, or every email operation throwing — so
 * signup verification, password reset, membership invitations, notifications
 * and marketing campaigns could not work at all.
 *
 * SMTP is used deliberately rather than a vendor SDK: Resend, SES, SendGrid,
 * Postmark and Mailgun all expose SMTP, so the platform is not locked to one
 * provider and switching is a config change. The `EmailProvider` seam is
 * unchanged, so a vendor-specific HTTP adapter can be added later without
 * touching callers.
 */

export type EmailSendInput = {
  to: string;
  subject: string;
  body: string;
  requestId: string;
  fromName?: string;
  fromEmail?: string;
  replyToEmail?: string | null;
};

export type EmailProvider = {
  isConfigured(): boolean;
  send(input: EmailSendInput): Promise<void>;
};

type ProviderMode = "smtp" | "mock" | "unconfigured";

const PRODUCTION_LIKE_ENVS = new Set(["production", "staging"]);

function resolveMode(env: NodeJS.ProcessEnv): ProviderMode {
  const configured = env["NOTIFICATION_EMAIL_PROVIDER"]?.trim().toLowerCase();
  if (configured === "smtp") return "smtp";
  if (configured === "mock") return "mock";
  return "unconfigured";
}

/** Logs a redacted line and discards. Never selectable in production. */
class MockEmailProvider implements EmailProvider {
  isConfigured(): boolean {
    return true;
  }

  async send(input: EmailSendInput): Promise<void> {
    if (process.env["NODE_ENV"] === "test") {
      await Promise.resolve();
      return;
    }
    // Only the recipient DOMAIN is logged, never the address.
    console.info("[notification-email:mock]", {
      requestId: input.requestId,
      toDomain: input.to.split("@")[1] ?? "unknown",
      subject: input.subject.slice(0, 80),
    });
    await Promise.resolve();
  }
}

class UnconfiguredEmailProvider implements EmailProvider {
  isConfigured(): boolean {
    return false;
  }

  send(): Promise<void> {
    return Promise.reject(new Error("EMAIL_PROVIDER_NOT_CONFIGURED"));
  }
}

export class SmtpEmailProvider implements EmailProvider {
  private transporter: Transporter | null = null;

  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}

  isConfigured(): boolean {
    return Boolean(this.env["SMTP_HOST"] && this.env["NOTIFICATION_EMAIL_FROM"]);
  }

  private getTransporter(): Transporter {
    if (this.transporter) return this.transporter;

    const host = this.env["SMTP_HOST"];
    if (!host) throw new Error("EMAIL_PROVIDER_NOT_CONFIGURED");

    const port = Number.parseInt(this.env["SMTP_PORT"] ?? "587", 10);
    const user = this.env["SMTP_USER"];
    const pass = this.env["SMTP_PASSWORD"];

    this.transporter = createTransport({
      host,
      port: Number.isFinite(port) ? port : 587,
      // 465 is implicit TLS; other ports upgrade via STARTTLS.
      secure: port === 465,
      ...(user && pass ? { auth: { user, pass } } : {}),
    });

    return this.transporter;
  }

  async send(input: EmailSendInput): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error("EMAIL_PROVIDER_NOT_CONFIGURED");
    }

    const defaultFrom = this.env["NOTIFICATION_EMAIL_FROM"] ?? "";
    const fromEmail = input.fromEmail?.trim() || defaultFrom;
    const from = input.fromName ? `"${input.fromName}" <${fromEmail}>` : fromEmail;

    await this.getTransporter().sendMail({
      from,
      to: input.to,
      subject: input.subject,
      html: input.body,
      ...(input.replyToEmail ? { replyTo: input.replyToEmail } : {}),
      headers: { "X-Request-Id": input.requestId },
    });
  }
}

let cachedProvider: EmailProvider | null = null;

export function getEmailProvider(env: NodeJS.ProcessEnv = process.env): EmailProvider {
  if (cachedProvider) return cachedProvider;

  const mode = resolveMode(env);
  const appEnv = env["APP_ENV"] ?? "";
  const productionLike = PRODUCTION_LIKE_ENVS.has(appEnv);

  // Fail closed. Silently discarding password resets and signup verifications
  // in production is worse than refusing to start.
  if (productionLike && mode !== "smtp") {
    throw new Error(
      `NOTIFICATION_EMAIL_PROVIDER must be "smtp" when APP_ENV=${appEnv} (got "${mode}"). ` +
        "A mock or unconfigured provider silently discards password resets and signup verification.",
    );
  }

  if (mode === "smtp") {
    const provider = new SmtpEmailProvider(env);
    if (productionLike && !provider.isConfigured()) {
      throw new Error(
        "SMTP email provider is selected but SMTP_HOST / NOTIFICATION_EMAIL_FROM are not set.",
      );
    }
    cachedProvider = provider;
  } else if (mode === "mock") {
    cachedProvider = new MockEmailProvider();
  } else {
    cachedProvider = new UnconfiguredEmailProvider();
  }

  return cachedProvider;
}

export function setEmailProviderForTests(provider: EmailProvider | null): void {
  cachedProvider = provider;
}
