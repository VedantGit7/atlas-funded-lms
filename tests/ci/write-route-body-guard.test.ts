import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { findWriteRoutesReadingQuery } from "../../scripts/guards/lib/write-route-body.mjs";

/** A route file with one handler, shaped like the real ones. */
function route(method: string, inputLine: string): string {
  return [
    'import { createTenantRoute } from "@atlas/api";',
    "",
    `export const ${method} = createTenantRoute({`,
    "  metadata: someMetadata,",
    inputLine,
    "  output: someResponseSchema,",
    "  handler: async ({ tx, ctx, input }) => doIt(tx, ctx, input),",
    "});",
    "",
  ].join("\n");
}

describe("write route body guard (QA review 2, C9)", () => {
  it("flags a write route that passes a body schema as input:", () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      expect(findWriteRoutesReadingQuery(route(method, "  input: createBatchBodySchema,"))).toEqual(
        [{ method, line: 5, value: "createBatchBodySchema" }],
      );
    }
  });

  it("flags an inline schema passed as input: on a write", () => {
    expect(
      findWriteRoutesReadingQuery(route("POST", "  input: z.object({ name: z.string() }),")),
    ).toHaveLength(1);
  });

  it("allows body:, and input: for schemas that really are queries", () => {
    expect(findWriteRoutesReadingQuery(route("POST", "  body: createBatchBodySchema,"))).toEqual(
      [],
    );
    expect(findWriteRoutesReadingQuery(route("POST", "  input: noBodySchema,"))).toEqual([]);
    expect(findWriteRoutesReadingQuery(route("POST", "  input: emptyBodySchema,"))).toEqual([]);
    expect(findWriteRoutesReadingQuery(route("DELETE", "  input: detachTagQuerySchema,"))).toEqual(
      [],
    );
  });

  it("ignores GET routes, which read the query by design", () => {
    expect(findWriteRoutesReadingQuery(route("GET", "  input: listBatchesBodySchema,"))).toEqual(
      [],
    );
  });

  it("ignores input: inside handler code", () => {
    const source = [
      "export const POST = createPublicRouteHandler({",
      "  handler: async ({ input }) => {",
      "    return login({",
      "      input: { email: input.email },",
      "    });",
      "  },",
      "});",
    ].join("\n");
    expect(findWriteRoutesReadingQuery(source)).toEqual([]);
  });

  it("passes on the whole API", () => {
    expect(() =>
      execFileSync(process.execPath, ["scripts/guards/check-write-route-body.mjs"], {
        stdio: "pipe",
      }),
    ).not.toThrow();
  });
});
