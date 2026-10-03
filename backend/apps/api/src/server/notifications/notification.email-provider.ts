import { createTransport, type Transporter } from "nodemailer";
import { createHash } from "node:crypto";
import { OutboxDeliveryError } from "@atlas/events/services/outbox-worker.service";
import { recordTenantUsage } from "@atlas/api/tenant-usage-meter";
import { isDeployedRuntime } from "@atlas/core/config/runtime-environment";

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
  /**
   * The tenant this email is sent on behalf of, or null for platform email that
   * belongs to no tenant. Required rather than optional so that every sender has
   * to decide: an optional field would default to "unattributed" at each call
   * site nobody remembered, and the email bill would drift away from the tenants
   * who caused it without any error (DoD item 8, cost attribution).
   */
  tenantId: string | null;
  to: string;
  subject: string;
  body: string;
  requestId: string;
  /** Stable delivery identity; SMTP Message-ID is correlation, not deduplication. */
  idempotencyKey?: string;
  messageId?: string;
  fromName?: string;
  fromEmail?: string;
  replyToEmail?: string | null;
};

export type EmailProvider = {
  /** True only for providers that guarantee deduplication of this key. */
  supportsIdempotency?: boolean;
  isConfigured(): boolean;
  send(input: EmailSendInput): Promise<void>;
};

type ProviderMode = "smtp" | "mock" | "unconfigured";

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
  readonly supportsIdempotency = false;
  private transporter: Transporter | null = null;

  /**
   * `transportFactory` exists for tests. Mocking nodemailer by module path stopped working when
   * nodemailer 10 split into separate ESM and CommonJS builds, so tests inject the fake instead.
   */
  constructor(
    private readonly env: NodeJS.ProcessEnv = process.env,
    private readonly transportFactory: typeof createTransport = createTransport,
  ) {}

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

    this.transporter = this.transportFactory({
      host,
      port: Number.isFinite(port) ? port : 587,
      // 465 is implicit TLS; other ports upgrade via STARTTLS.
      secure: port === 465,
      requireTLS: isDeployedRuntime(this.env) && port !== 465,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 30_000,
      ...(user && pass ? { auth: { user, pass } } : {}),
    });

    return this.transporter;
  }

  async send(input: EmailSendInput): Promise<void> {
    if (!this.isConfigured()) {
      throw new OutboxDeliveryError("permanent", "EMAIL_PROVIDER_NOT_CONFIGURED");
    }

    const defaultFrom = this.env["NOTIFICATION_EMAIL_FROM"] ?? "";
    const fromEmail = input.fromEmail?.trim() || defaultFrom;
    const from = input.fromName ? `"${input.fromName}" <${fromEmail}>` : fromEmail;

    const transporter = this.getTransporter();
    const messageId =
      input.messageId ??
      (input.idempotencyKey
        ? `<atlas-${createHash("sha256").update(input.idempotencyKey).digest("hex")}@outbox.local>`
        : undefined);
    let deadline: ReturnType<typeof setTimeout> | undefined;
    try {
      const result: unknown = await Promise.race([
        transporter.sendMail({
          from,
          to: input.to,
          subject: input.subject,
          html: input.body,
          ...(messageId ? { messageId } : {}),
          ...(input.replyToEmail ? { replyTo: input.replyToEmail } : {}),
          headers: { "X-Request-Id": input.requestId },
        }),
        new Promise<never>((_resolve, reject) => {
          deadline = setTimeout(() => {
            reject(new OutboxDeliveryError("reconciliation_required", "SMTP_DEADLINE_EXCEEDED"));
            transporter.close();
            this.transporter = null;
          }, 45_000);
        }),
      ]);
      if (
        typeof result !== "object" ||
        result === null ||
        !("accepted" in result) ||
        !Array.isArray(result.accepted) ||
        result.accepted.length === 0
      ) {
        throw new OutboxDeliveryError("reconciliation_required", "SMTP_ACCEPTANCE_UNKNOWN");
      }
    } catch (error) {
      if (error instanceof OutboxDeliveryError) throw error;
      const responseCode =
        typeof error === "object" && error !== null && "responseCode" in error
          ? error.responseCode
          : undefined;
      // An explicit negative SMTP reply proves this submission was rejected.
      // A socket loss or timeout can happen after acceptance, so never retry it.
      if (typeof responseCode === "number" && responseCode >= 400 && responseCode < 600) {
        throw new OutboxDeliveryError(
          responseCode < 500 ? "retryable" : "permanent",
          `SMTP_${responseCode}`,
        );
      }
      throw new OutboxDeliveryError("reconciliation_required", "SMTP_ACCEPTANCE_UNKNOWN");
    } finally {
      if (deadline !== undefined) clearTimeout(deadline);
    }
  }
}

/**
 * Counts each successfully sent email against its tenant. A decorator rather
 * than a line in SmtpEmailProvider.send, so every provider the factory can
 * return is metered the same way and a future vendor adapter cannot forget to.
 * Failed sends are not counted: an SMTP rejection is not billed.
 */
class MeteredEmailProvider implements EmailProvider {
  constructor(private readonly inner: EmailProvider) {}

  get supportsIdempotency(): boolean {
    return this.inner.supportsIdempotency === true;
  }

  isConfigured(): boolean {
    return this.inner.isConfigured();
  }

  async send(input: EmailSendInput): Promise<void> {
    await this.inner.send(input);
    if (input.tenantId !== null) {
      await recordTenantUsage(input.tenantId, { emails: 1 });
    }
  }
}

let cachedProvider: EmailProvider | null = null;
let cachedForDeployment = false;

export function getEmailProvider(env: NodeJS.ProcessEnv = process.env): EmailProvider {
  const mode = resolveMode(env);
  const appEnv = env["APP_ENV"] ?? "";
  const productionLike = isDeployedRuntime(env);

  // Fail closed. Silently discarding password resets and signup verifications
  // in production is worse than refusing to start.
  if (productionLike && mode !== "smtp") {
    throw new Error(
      `NOTIFICATION_EMAIL_PROVIDER must be "smtp" when APP_ENV=${appEnv} (got "${mode}"). ` +
        "A mock or unconfigured provider silently discards password resets and signup verification.",
    );
  }

  if (productionLike && mode === "smtp" && !new SmtpEmailProvider(env).isConfigured()) {
    throw new Error(
      "SMTP email provider is selected but SMTP_HOST / NOTIFICATION_EMAIL_FROM are not set.",
    );
  }
  if (productionLike && !cachedForDeployment) cachedProvider = null;
  if (cachedProvider) return cachedProvider;
  cachedForDeployment = productionLike;

  if (mode === "smtp") {
    const provider = new SmtpEmailProvider(env);
    if (productionLike && !provider.isConfigured()) {
      throw new Error(
        "SMTP email provider is selected but SMTP_HOST / NOTIFICATION_EMAIL_FROM are not set.",
      );
    }
    cachedProvider = new MeteredEmailProvider(provider);
  } else if (mode === "mock") {
    cachedProvider = new MeteredEmailProvider(new MockEmailProvider());
  } else {
    cachedProvider = new UnconfiguredEmailProvider();
  }

  return cachedProvider;
}

export function setEmailProviderForTests(provider: EmailProvider | null): void {
  cachedProvider = provider;
  cachedForDeployment = false;
}
