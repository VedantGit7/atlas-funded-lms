import { describe, expect, it } from "vitest";
import {
  createDestinationBodySchema,
  destinationsRosterListQuerySchema,
  updateDestinationBodySchema,
} from "@atlas/domain/reports/destinations-roster.dto";
import {
  isExternalEmail,
  maskSecret,
  parseHealth,
  parseWebhookParts,
  pushHealthDay,
} from "@atlas/domain/reports/destinations-roster.repository";

describe("destinations roster helpers", () => {
  it("masks secrets and tracks health", () => {
    expect(maskSecret("abcdefghij")).toBe("••••ghij");
    expect(parseHealth([])).toHaveLength(20);
    expect(pushHealthDay([], "success").at(-1)).toBe("success");
    expect(pushHealthDay(["fail"], "success").at(-1)).toBe("success");
  });

  it("detects external emails and parses webhook hosts", () => {
    expect(isExternalEmail("a@gmail.com", ["example.com"])).toBe(true);
    expect(isExternalEmail("a@example.com", ["example.com"])).toBe(false);
    expect(parseWebhookParts("https://hooks.example.com/path/long").host).toBe("hooks.example.com");
  });

  it("parses list query and create bodies", () => {
    const list = destinationsRosterListQuerySchema.parse({});
    expect(list.status).toBe("all");
    expect(list.kind).toBe("any");

    expect(() =>
      destinationsRosterListQuerySchema.parse({
        tenantId: "11111111-1111-4111-8111-111111111111",
      }),
    ).toThrow();

    const email = createDestinationBodySchema.parse({
      kind: "email",
      name: "Finance",
      emails: ["a@example.com"],
    });
    expect(email.kind).toBe("email");

    const webhook = createDestinationBodySchema.parse({
      kind: "webhook",
      name: "Ops",
      url: "https://example.com/hook",
    });
    expect(webhook.kind).toBe("webhook");

    const patch = updateDestinationBodySchema.parse({ isActive: false });
    expect(patch.isActive).toBe(false);
  });
});
