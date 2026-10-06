import { describe, expect, it } from "vitest";
import { UPLOAD_CORS_RULE } from "@atlas/storage/r2-cors";
import { r2BucketCors } from "@atlas/storage/r2-bucket-cors";

/**
 * The bucket CORS calls `pnpm storage:r2-cors` makes, through the real AWS SDK
 * with the network replaced: the request R2 receives and the answers it parses.
 */

type Sent = { method: string; path: string; query: Record<string, unknown>; body: string };

function bucketAnswering(status: number, body: string) {
  const sent: Sent[] = [];
  const cors = r2BucketCors(
    {
      R2_ACCOUNT_ID: "acct",
      R2_ACCESS_KEY_ID: "key",
      R2_SECRET_ACCESS_KEY: "secret",
      R2_BUCKET_NAME: "atlas-assets",
    },
    {
      requestHandler: {
        handle: async (request: {
          method: string;
          path: string;
          query: Record<string, unknown>;
          body?: unknown;
        }) => {
          sent.push({
            method: request.method,
            path: request.path,
            query: request.query,
            body: typeof request.body === "string" ? request.body : String(request.body ?? ""),
          });
          return {
            response: {
              statusCode: status,
              headers: { "content-type": "application/xml" },
              body: new TextEncoder().encode(body),
            },
          };
        },
      },
    },
  );
  return { cors, sent };
}

describe("bucket CORS through R2's S3 API", () => {
  it("writes the rules as a PutBucketCors on the bucket", async () => {
    const { cors, sent } = bucketAnswering(200, "");
    await cors.put([UPLOAD_CORS_RULE]);

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ method: "PUT", path: "/atlas-assets/" });
    expect(Object.keys(sent[0]?.query ?? {})).toContain("cors");
    const xml = sent[0]?.body ?? "";
    expect(xml).toContain("<AllowedOrigin>*</AllowedOrigin>");
    expect(xml).toContain("<AllowedMethod>PUT</AllowedMethod>");
    expect(xml).toContain("<AllowedHeader>content-type</AllowedHeader>");
    expect(xml).toContain("<AllowedHeader>content-disposition</AllowedHeader>");
    expect(xml).toContain("<MaxAgeSeconds>3600</MaxAgeSeconds>");
  });

  it("reads the rules R2 returns", async () => {
    const { cors, sent } = bucketAnswering(
      200,
      `<?xml version="1.0" encoding="UTF-8"?>
      <CORSConfiguration>
        <CORSRule>
          <AllowedOrigin>*</AllowedOrigin>
          <AllowedMethod>PUT</AllowedMethod>
          <AllowedHeader>content-type</AllowedHeader>
          <MaxAgeSeconds>600</MaxAgeSeconds>
        </CORSRule>
      </CORSConfiguration>`,
    );
    await expect(cors.get()).resolves.toEqual([
      {
        AllowedOrigins: ["*"],
        AllowedMethods: ["PUT"],
        AllowedHeaders: ["content-type"],
        ExposeHeaders: undefined,
        MaxAgeSeconds: 600,
      },
    ]);
    expect(sent[0]).toMatchObject({ method: "GET", path: "/atlas-assets/" });
  });

  it("treats a bucket with no CORS configuration as having no rules", async () => {
    const { cors } = bucketAnswering(
      404,
      `<?xml version="1.0" encoding="UTF-8"?>
      <Error><Code>NoSuchCORSConfiguration</Code><Message>The CORS configuration does not exist</Message></Error>`,
    );
    await expect(cors.get()).resolves.toEqual([]);
  });

  it("does not hide other failures, such as a token without admin rights", async () => {
    const { cors } = bucketAnswering(
      403,
      `<?xml version="1.0" encoding="UTF-8"?>
      <Error><Code>AccessDenied</Code><Message>Access Denied</Message></Error>`,
    );
    await expect(cors.get()).rejects.toMatchObject({
      name: "AccessDenied",
    });
  });
});
