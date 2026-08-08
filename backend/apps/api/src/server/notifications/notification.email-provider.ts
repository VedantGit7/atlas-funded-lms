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

class UnconfiguredEmailProvider implements EmailProvider {
  isConfigured(): boolean {
    return false;
  }

  send(): Promise<void> {
    return Promise.reject(new Error("EMAIL_PROVIDER_NOT_CONFIGURED"));
  }
}

class EnvEmailProvider implements EmailProvider {
  isConfigured(): boolean {
    return process.env["NOTIFICATION_EMAIL_PROVIDER"] === "mock";
  }

  async send(input: EmailSendInput): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error("EMAIL_PROVIDER_NOT_CONFIGURED");
    }
    if (process.env["NODE_ENV"] === "test") {
      await Promise.resolve();
      return;
    }
    console.info("[notification-email]", {
      requestId: input.requestId,
      toDomain: input.to.split("@")[1] ?? "unknown",
      ...(input.fromEmail ? { fromEmail: input.fromEmail } : {}),
      ...(input.fromName ? { fromName: input.fromName } : {}),
      ...(input.replyToEmail ? { replyToEmail: input.replyToEmail } : {}),
      subject: input.subject.slice(0, 80),
    });
    await Promise.resolve();
  }
}

let cachedProvider: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (!cachedProvider) {
    cachedProvider =
      process.env["NOTIFICATION_EMAIL_PROVIDER"] === "mock"
        ? new EnvEmailProvider()
        : new UnconfiguredEmailProvider();
  }
  return cachedProvider;
}

export function setEmailProviderForTests(provider: EmailProvider | null): void {
  cachedProvider = provider;
}
