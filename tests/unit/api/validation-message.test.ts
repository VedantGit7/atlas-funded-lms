import { describe, expect, it } from "vitest";
import { z } from "zod";
import { toSafeErrorEnvelope } from "@atlas/core/http/errors";
import { describeValidationIssues, humanizeFieldName } from "@atlas/core/http/validation-message";
import { createSpaceBodySchema } from "../../../backend/apps/api/src/server/community/community.dto";
import { updateMarketingCtaDesignBodySchema } from "../../../backend/apps/api/src/server/marketing-cta/marketing-cta.schemas";

/**
 * QA S2.5 (review 2 H33): a rejected form said only "Invalid request", so an
 * invalid community slug or a bad CTA link failed with nothing to act on.
 */
function messageFor(schema: z.ZodType, body: unknown): string {
  const result = schema.safeParse(body);
  if (result.success) throw new Error("expected the body to be refused");
  const envelope = toSafeErrorEnvelope(result.error, "req_test");
  expect(envelope.status).toBe(400);
  expect(envelope.body.error.code).toBe("VALIDATION_ERROR");
  return envelope.body.error.message;
}

describe("plain reasons for a refused request", () => {
  it("explains an invalid community web address", () => {
    expect(messageFor(createSpaceBodySchema, { slug: "Trading Q&A", name: "Trading" })).toBe(
      "Web address can use only lowercase letters, numbers and hyphens.",
    );
    expect(messageFor(createSpaceBodySchema, { slug: "a", name: "Trading" })).toBe(
      "Web address needs at least 2 characters.",
    );
  });

  it("names every field to fix, not only the first", () => {
    expect(messageFor(createSpaceBodySchema, { slug: "x", name: "" })).toBe(
      "Web address needs at least 2 characters. Also check: Name.",
    );
  });

  it("uses the schema's own words when it has them, even inside a union", () => {
    // The CTA design form's link field: empty, nothing, or a link.
    const linkField = updateMarketingCtaDesignBodySchema.pick({ linkUrl: true });
    expect(messageFor(linkField, { linkUrl: "javascript:alert(1)" })).toBe(
      "Enter a full web address (https://…) or a page on your site, like /courses.",
    );
  });

  it("says a missing field is required", () => {
    const schema = z.object({ title: z.string() });
    expect(messageFor(schema, {})).toBe("Title is required.");
  });

  it("lists the allowed options when there are a few", () => {
    const schema = z.object({ visibility: z.enum(["PUBLIC", "PRIVATE"]) });
    expect(messageFor(schema, { visibility: "SECRET" })).toBe(
      "Visibility must be one of: PUBLIC, PRIVATE.",
    );
  });

  it("asks for a reload when the page sent a field the server doesn't know", () => {
    const schema = z.object({ title: z.string() }).strict();
    expect(messageFor(schema, { title: "A", extra: 1 })).toBe(
      "This page is out of date. Reload it and try again.",
    );
  });

  it("never repeats what was typed", () => {
    const secret = "my-private-value-123";
    const schema = z.object({ email: z.email() });
    expect(messageFor(schema, { email: secret })).not.toContain(secret);
  });

  it("names fields the way a person reads them", () => {
    expect(humanizeFieldName("linkUrl")).toBe("Link");
    expect(humanizeFieldName("seoTitle")).toBe("SEO title");
    expect(humanizeFieldName("start_at")).toBe("Start at");
    expect(describeValidationIssues([])).toBe(
      "Some of the details aren't valid. Check the form and try again.",
    );
  });
});
