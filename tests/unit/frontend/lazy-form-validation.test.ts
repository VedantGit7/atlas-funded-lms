import { expect, it } from "vitest";
import { createLazyZodResolver } from "../../../frontend/apps/web/src/lib/forms/use-lazy-zod-form";

const options = { fields: {}, shouldUseNativeValidation: false };
it("waits for validation, preserves the auth schema, and caches a successful load", async () => {
  let loads = 0;
  const resolver = createLazyZodResolver(async () => {
    loads += 1;
    return (
      await import("../../../frontend/packages/contracts/src/domain-identity/schemas/public-auth")
    ).PublicLoginRequestSchema;
  }, "email");
  expect(loads).toBe(0);
  const invalid = await resolver({ email: "bad", password: "" }, undefined, options);
  expect(invalid.errors).toHaveProperty("email");
  expect(invalid.errors).toHaveProperty("password");
  const input = { email: "learner@example.test", password: "secret-test" };
  const valid = await resolver(input, undefined, options);
  expect(valid.errors).toEqual({});
  expect(valid.values).toMatchObject(input);
  expect(loads).toBe(1);
});

it("blocks submission on a failed chunk, exposes a field error, and retries", async () => {
  let loads = 0;
  const resolver = createLazyZodResolver(async () => {
    loads += 1;
    if (loads === 1) throw new Error("chunk unavailable");
    return (
      await import("../../../frontend/packages/contracts/src/domain-identity/schemas/public-auth")
    ).PublicLoginRequestSchema;
  }, "email");
  const input = { email: "learner@example.test", password: "secret-test" };
  const failed = await resolver(input, undefined, options);
  expect(failed.values).toEqual({});
  expect(failed.errors.email?.message).toContain("try again");
  expect((await resolver(input, undefined, options)).errors).toEqual({});
  expect(loads).toBe(2);
});
