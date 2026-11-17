import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { noBodySchema } from "@atlas/api";
import { readJsonBody } from "@atlas/api/read-json-body";

/**
 * Action routes (publish branding, and every other route declared with
 * noBodySchema) receive no body from the web client. Reading that empty body
 * with req.json() threw, so the action failed with a 500 (November 2026).
 */
const post = (body?: string) =>
  new NextRequest("https://academy.example.test/api/v1/branding/publish", {
    method: "POST",
    ...(body === undefined ? {} : { body, headers: { "content-type": "application/json" } }),
  });

describe("readJsonBody", () => {
  it("reads a request with no body as an empty object", async () => {
    await expect(readJsonBody(post(), noBodySchema)).resolves.toEqual({});
    await expect(readJsonBody(post(""), noBodySchema)).resolves.toEqual({});
  });

  it("still validates an empty body against a schema that needs fields", async () => {
    const schema = z.object({ name: z.string() });
    await expect(readJsonBody(post(), schema)).rejects.toMatchObject({ name: "ZodError" });
  });

  it("parses and validates a JSON body", async () => {
    const schema = z.object({ name: z.string() });
    await expect(readJsonBody(post('{"name":"x"}'), schema)).resolves.toEqual({ name: "x" });
    await expect(readJsonBody(post("{}"), noBodySchema)).resolves.toEqual({});
  });

  it("answers a body that is not JSON with a 400, not a server error", async () => {
    await expect(readJsonBody(post("{not json"), noBodySchema)).rejects.toMatchObject({
      status: 400,
      code: "VALIDATION_ERROR",
    });
  });
});
