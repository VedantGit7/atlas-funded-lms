export type WhatsappTemplateSendInput = {
  toPhone: string;
  templateName: string;
  language: string;
  body: string;
  headerImageUrl?: string | null;
  requestId: string;
};

export type WhatsappFreeformSendInput = {
  toPhone: string;
  body: string;
  requestId: string;
};

export type WhatsappSubmitTemplateInput = {
  name: string;
  category: string;
  language: string;
  headerType: "NONE" | "TEXT" | "IMAGE";
  headerText?: string | null;
  headerImageUrl?: string | null;
  body: string;
  footer?: string | null;
  buttons?: Array<{ type: string; text: string; url?: string }>;
};

export type WhatsappSubmitTemplateResult = {
  status: "PENDING" | "APPROVED" | "REJECTED";
  metaTemplateId: string | null;
  rejectionReason: string | null;
};

export type WhatsappProviderCredentials = {
  accessToken: string;
  phoneNumberId: string;
  wabaId: string;
};

export type WhatsappProvider = {
  mode: "mock" | "meta";
  isConfigured(credentials: WhatsappProviderCredentials | null): boolean;
  submitTemplate(
    credentials: WhatsappProviderCredentials | null,
    input: WhatsappSubmitTemplateInput,
  ): Promise<WhatsappSubmitTemplateResult>;
  sendTemplate(
    credentials: WhatsappProviderCredentials | null,
    input: WhatsappTemplateSendInput,
  ): Promise<{ metaMessageId: string }>;
  sendFreeform(
    credentials: WhatsappProviderCredentials | null,
    input: WhatsappFreeformSendInput,
  ): Promise<{ metaMessageId: string }>;
};

class MockWhatsappProvider implements WhatsappProvider {
  mode = "mock" as const;

  isConfigured(): boolean {
    return true;
  }

  async submitTemplate(
    _credentials: WhatsappProviderCredentials | null,
    input: WhatsappSubmitTemplateInput,
  ): Promise<WhatsappSubmitTemplateResult> {
    // Simulate Meta review: auto-approve for local/dev so the flow is fully usable.
    return {
      status: "APPROVED",
      metaTemplateId: `mock_tpl_${input.name}`,
      rejectionReason: null,
    };
  }

  async sendTemplate(
    _credentials: WhatsappProviderCredentials | null,
    input: WhatsappTemplateSendInput,
  ): Promise<{ metaMessageId: string }> {
    if (process.env["NODE_ENV"] !== "test") {
      console.info("[whatsapp-mock] template", {
        requestId: input.requestId,
        to: input.toPhone,
        template: input.templateName,
        bodyPreview: input.body.slice(0, 80),
      });
    }
    return { metaMessageId: `mock_msg_${Date.now()}` };
  }

  async sendFreeform(
    _credentials: WhatsappProviderCredentials | null,
    input: WhatsappFreeformSendInput,
  ): Promise<{ metaMessageId: string }> {
    if (process.env["NODE_ENV"] !== "test") {
      console.info("[whatsapp-mock] freeform", {
        requestId: input.requestId,
        to: input.toPhone,
        bodyPreview: input.body.slice(0, 80),
      });
    }
    return { metaMessageId: `mock_msg_${Date.now()}` };
  }
}

class MetaWhatsappProvider implements WhatsappProvider {
  mode = "meta" as const;
  private readonly graphVersion = process.env["WHATSAPP_GRAPH_VERSION"] ?? "v21.0";

  isConfigured(credentials: WhatsappProviderCredentials | null): boolean {
    return Boolean(
      credentials?.accessToken && credentials.phoneNumberId && credentials.wabaId,
    );
  }

  private assertCredentials(
    credentials: WhatsappProviderCredentials | null,
  ): WhatsappProviderCredentials {
    if (!credentials || !this.isConfigured(credentials)) {
      throw new Error("WHATSAPP_PROVIDER_NOT_CONFIGURED");
    }
    return credentials;
  }

  async submitTemplate(
    credentials: WhatsappProviderCredentials | null,
    input: WhatsappSubmitTemplateInput,
  ): Promise<WhatsappSubmitTemplateResult> {
    const creds = this.assertCredentials(credentials);
    const components: Array<Record<string, unknown>> = [];

    if (input.headerType === "TEXT" && input.headerText) {
      components.push({
        type: "HEADER",
        format: "TEXT",
        text: input.headerText,
      });
    } else if (input.headerType === "IMAGE") {
      components.push({
        type: "HEADER",
        format: "IMAGE",
        example: input.headerImageUrl
          ? { header_handle: [input.headerImageUrl] }
          : undefined,
      });
    }

    components.push({ type: "BODY", text: input.body });

    if (input.footer?.trim()) {
      components.push({ type: "FOOTER", text: input.footer.trim() });
    }

    if (input.buttons && input.buttons.length > 0) {
      components.push({
        type: "BUTTONS",
        buttons: input.buttons.map((button) => {
          if (button.type === "URL" && button.url) {
            return { type: "URL", text: button.text, url: button.url };
          }
          return { type: "QUICK_REPLY", text: button.text };
        }),
      });
    }

    const response = await fetch(
      `https://graph.facebook.com/${this.graphVersion}/${creds.wabaId}/message_templates`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: input.name,
          category: input.category,
          language: input.language,
          components,
        }),
      },
    );

    const json = (await response.json()) as {
      id?: string;
      status?: string;
      error?: { message?: string };
    };

    if (!response.ok) {
      return {
        status: "REJECTED",
        metaTemplateId: null,
        rejectionReason: json.error?.message ?? `Meta template submit failed (${response.status})`,
      };
    }

    const statusRaw = (json.status ?? "PENDING").toUpperCase();
    const status =
      statusRaw === "APPROVED"
        ? "APPROVED"
        : statusRaw === "REJECTED"
          ? "REJECTED"
          : "PENDING";

    return {
      status,
      metaTemplateId: json.id ?? null,
      rejectionReason: null,
    };
  }

  async sendTemplate(
    credentials: WhatsappProviderCredentials | null,
    input: WhatsappTemplateSendInput,
  ): Promise<{ metaMessageId: string }> {
    const creds = this.assertCredentials(credentials);
    const to = input.toPhone.replace(/[^\d+]/g, "");
    const response = await fetch(
      `https://graph.facebook.com/${this.graphVersion}/${creds.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "template",
          template: {
            name: input.templateName,
            language: { code: input.language },
          },
        }),
      },
    );
    const json = (await response.json()) as {
      messages?: Array<{ id?: string }>;
      error?: { message?: string };
    };
    if (!response.ok) {
      throw new Error(json.error?.message ?? `WhatsApp send failed (${response.status})`);
    }
    const metaMessageId = json.messages?.[0]?.id;
    if (!metaMessageId) throw new Error("WhatsApp send returned no message id.");
    return { metaMessageId };
  }

  async sendFreeform(
    credentials: WhatsappProviderCredentials | null,
    input: WhatsappFreeformSendInput,
  ): Promise<{ metaMessageId: string }> {
    const creds = this.assertCredentials(credentials);
    const to = input.toPhone.replace(/[^\d+]/g, "");
    const response = await fetch(
      `https://graph.facebook.com/${this.graphVersion}/${creds.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: input.body },
        }),
      },
    );
    const json = (await response.json()) as {
      messages?: Array<{ id?: string }>;
      error?: { message?: string };
    };
    if (!response.ok) {
      throw new Error(json.error?.message ?? `WhatsApp send failed (${response.status})`);
    }
    const metaMessageId = json.messages?.[0]?.id;
    if (!metaMessageId) throw new Error("WhatsApp send returned no message id.");
    return { metaMessageId };
  }
}

let cachedMock: WhatsappProvider | null = null;
let cachedMeta: WhatsappProvider | null = null;

export function getWhatsappProvider(mode: "mock" | "meta" = "mock"): WhatsappProvider {
  if (mode === "meta") {
    if (!cachedMeta) cachedMeta = new MetaWhatsappProvider();
    return cachedMeta;
  }
  if (!cachedMock) cachedMock = new MockWhatsappProvider();
  return cachedMock;
}

/** @deprecated Prefer getWhatsappProvider(connection.provider_mode) */
export function getDefaultWhatsappProvider(): WhatsappProvider {
  const mode = (process.env["WHATSAPP_PROVIDER"] ?? "mock").toLowerCase();
  return getWhatsappProvider(mode === "meta" ? "meta" : "mock");
}

export function setWhatsappProviderForTests(provider: WhatsappProvider | null): void {
  cachedMock = provider;
  cachedMeta = provider;
}
