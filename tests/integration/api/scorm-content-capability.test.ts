import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { withTenantTx, type TenantTx } from "@atlas/db";
import { buildScormContentStorageKey } from "@atlas/storage/scorm-package-extract";
import {
  authoringTenantTx,
  createCourseAuthoringFixture,
  learnerCtx,
  type CourseAuthoringFixture,
} from "../../fixtures/course-authoring-fixture";
import { insertCourseModule } from "../../../backend/apps/api/src/server/courses/course-authoring.repository";
import {
  getModuleScormLaunchForLearner,
  getModuleScormProgressForLearner,
  recordModuleScormProgressForLearner,
} from "../../../backend/apps/api/src/server/courses/module-scorm-learner.service";

// In-memory package storage, keyed exactly as the processing worker publishes it.
const objects = vi.hoisted(() => new Map<string, Buffer>());
vi.mock("@atlas/storage/providers/storage-provider-factory", async () => {
  const { Readable } = await import("node:stream");
  const body = (key: string) => objects.get(key) ?? null;
  return {
    getStorageProvider: () => ({
      getObjectBody: async ({ key }: { key: string }) => body(key),
      headObject: async ({ key }: { key: string }) => {
        const found = body(key);
        return found ? { contentType: "application/octet-stream", sizeBytes: found.length } : null;
      },
      getObjectStream: async ({
        key,
        range,
      }: {
        key: string;
        range?: { start: number; end: number };
      }) => {
        const found = body(key);
        if (!found) return null;
        return Readable.from([range ? found.subarray(range.start, range.end + 1) : found]);
      },
    }),
  };
});

const { GET } =
  await import("../../../backend/apps/api/src/app/api/v1/public/scorm/[token]/[...path]/route");

const suite =
  process.env.DATABASE_URL && process.env.PLATFORM_DATABASE_URL ? describe : describe.skip;

suite("SCORM package-read capability against the database", () => {
  let fixture: CourseAuthoringFixture;
  let moduleId: string;
  let contentVersion: string;
  const learnerTx = <T>(fn: (tx: TenantTx) => Promise<T>) =>
    withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), fn);
  const ownerTx = <T>(fn: (tx: TenantTx) => Promise<T>) =>
    withTenantTx(authoringTenantTx(fixture), fn);

  function store(path: string, content: string | Buffer, version = contentVersion) {
    objects.set(
      buildScormContentStorageKey({
        tenantId: fixture.tenantId,
        moduleId,
        relativePath: path,
        contentVersion: version,
      }),
      Buffer.isBuffer(content) ? content : Buffer.from(content),
    );
  }

  async function launch() {
    const result = await learnerTx((tx) =>
      getModuleScormLaunchForLearner(tx, learnerCtx(fixture), moduleId),
    );
    return result.data;
  }

  async function fetchPackage(url: string, headers: Record<string, string> = {}) {
    const { pathname } = new URL(url, "https://academy.example.test");
    const [, , , , , token = "", ...path] = pathname.split("/");
    return GET(new NextRequest(`https://academy.example.test${pathname}`, { headers }), {
      params: Promise.resolve({ token, path: path.map((segment) => decodeURIComponent(segment)) }),
    });
  }
  const sibling = (contentUrl: string, path: string) =>
    `${contentUrl.split("/").slice(0, 6).join("/")}/${path}`;

  beforeAll(async () => {
    vi.stubEnv("SCORM_CONTENT_SIGNING_KEYS", `it:${randomUUID()}${randomUUID()}`);
    fixture = await createCourseAuthoringFixture();
    contentVersion = randomUUID();
    const module = await ownerTx((tx) =>
      insertCourseModule({
        tx,
        tenantId: fixture.tenantId,
        courseId: fixture.draftCourseId,
        title: "SCORM capability",
        position: 1,
        contentKind: "scorm",
      }),
    );
    moduleId = module.id;
    await ownerTx(async (tx) => {
      await tx.$executeRaw`update courses set status = 'PUBLISHED' where id = ${fixture.draftCourseId}::uuid`;
      await tx.$executeRaw`
        update course_modules
        set status = 'PUBLISHED', scorm_launch_path = 'course content/index.html',
            scorm_version = '2004', scorm_content_version = ${contentVersion}::uuid
        where id = ${moduleId}::uuid
      `;
      await tx.$executeRaw`
        insert into enrollments (id, tenant_id, course_id, membership_id, status, enrolled_at)
        values (${randomUUID()}::uuid, ${fixture.tenantId}::uuid, ${fixture.draftCourseId}::uuid,
                ${fixture.learnerMembershipId}::uuid, 'active', now())
      `;
    });
    store(
      "course content/index.html",
      '<!doctype html><html><head><meta charset="utf-8"><script src="js/app.js"></script></head><body>Lesson</body></html>',
    );
    store("course content/js/app.js", "window.started = true;");
    store("course content/media/clip.mp4", Buffer.from("0123456789"));
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it("launches into a capability path whose relative files resolve and load", async () => {
    const data = await launch();
    expect(data.contentUrl).toMatch(
      /^\/api\/v1\/public\/scorm\/[A-Za-z0-9_.-]+\/course%20content\/index\.html$/,
    );
    expect(data.launchId).toMatch(/^[A-Za-z0-9_-]{16,64}$/);

    const page = await fetchPackage(data.contentUrl);
    expect(page.status).toBe(200);
    expect(page.headers.get("content-security-policy")).toContain("sandbox allow-scripts");
    expect(page.headers.get("content-security-policy")).not.toContain("allow-same-origin");
    expect(page.headers.get("cache-control")).toBe("private, no-store");
    const html = await page.text();
    expect(html).toContain('<meta charset="utf-8"><script src="/api/v1/public/scorm/');
    expect(html).toContain('/.atlas-scorm-runtime.js"></script><script src="js/app.js">');

    const script = await fetchPackage(sibling(data.contentUrl, "course%20content/js/app.js"));
    expect(script.status).toBe(200);
    expect(script.headers.get("content-type")).toBe("application/javascript");
    expect(await script.text()).toBe("window.started = true;");
  });

  it("serves byte ranges for media, and refuses unsatisfiable ones", async () => {
    const { contentUrl } = await launch();
    const clip = sibling(contentUrl, "course%20content/media/clip.mp4");
    const partial = await fetchPackage(clip, { range: "bytes=2-5" });
    expect(partial.status).toBe(206);
    expect(partial.headers.get("content-range")).toBe("bytes 2-5/10");
    expect(await partial.text()).toBe("2345");
    const suffix = await fetchPackage(clip, { range: "bytes=-3" });
    expect(await suffix.text()).toBe("789");
    expect((await fetchPackage(clip, { range: "bytes=50-" })).status).toBe(416);
  });

  it("refuses traversal, unknown files and forged or foreign capabilities alike", async () => {
    const { contentUrl } = await launch();
    for (const url of [
      sibling(contentUrl, "course%20content/..%2F..%2Fsecret"),
      sibling(contentUrl, "course%20content/missing.js"),
      contentUrl.replace(/\/scorm\/[^/]+\//, "/scorm/it.e30.AAAA/"),
    ]) {
      const response = await fetchPackage(url);
      expect(response.status).toBe(404);
      expect(await response.text()).not.toContain(fixture.tenantId);
    }
  });

  it("never writes the capability to logs, on success or refusal", async () => {
    const { contentUrl } = await launch();
    const token = contentUrl.split("/")[5] ?? "";
    expect(token.length).toBeGreaterThan(40);
    const written: string[] = [];
    const capture = (chunk: unknown) => {
      written.push(String(chunk));
      return true;
    };
    const spies = [
      vi.spyOn(process.stdout, "write").mockImplementation(capture),
      vi.spyOn(process.stderr, "write").mockImplementation(capture),
      ...(["log", "info", "warn", "error"] as const).map((method) =>
        vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
          written.push(args.map(String).join(" "));
        }),
      ),
    ];
    try {
      await fetchPackage(contentUrl);
      await fetchPackage(sibling(contentUrl, "course%20content/missing.js"));
      await fetchPackage(sibling(contentUrl, ".atlas-scorm-runtime.js"));
    } finally {
      for (const spy of spies) spy.mockRestore();
    }
    expect(written.join("\n")).toContain("/api/v1/public/scorm/[token]/[...path]");
    expect(written.join("\n")).not.toContain(token.split(".")[2] ?? "missing-signature");
  });

  it("refuses to be loaded as an app page's own subresource", async () => {
    const { contentUrl } = await launch();
    const asScript = await fetchPackage(sibling(contentUrl, "course%20content/js/app.js"), {
      "sec-fetch-site": "same-origin",
      "sec-fetch-dest": "script",
    });
    expect(asScript.status).toBe(404);
    const asIframe = await fetchPackage(contentUrl, {
      "sec-fetch-site": "same-origin",
      "sec-fetch-dest": "iframe",
    });
    expect(asIframe.status).toBe(200);
    const fromPackage = await fetchPackage(sibling(contentUrl, "course%20content/js/app.js"), {
      "sec-fetch-site": "cross-site",
      "sec-fetch-dest": "script",
    });
    expect(fromPackage.status).toBe(200);
  });

  it("seeds each document's runtime with saved data, resume and accumulated time", async () => {
    const ctx = learnerCtx(fixture);
    await learnerTx((tx) =>
      recordModuleScormProgressForLearner(tx, ctx, moduleId, {
        cmi: { "cmi.location": "slide-4", "cmi.exit": "suspend", "cmi.session_time": "PT2M" },
        terminated: true,
      }),
    );
    const { contentUrl, launchId } = await launch();
    const runtime = await fetchPackage(sibling(contentUrl, ".atlas-scorm-runtime.js"));
    expect(runtime.status).toBe(200);
    expect(runtime.headers.get("cache-control")).toBe("private, no-store");
    const source = await runtime.text();
    // The learner's data is the argument appended after the runtime itself.
    const config = JSON.parse(
      source.slice(source.lastIndexOf("})(") + 3).replace(/\);\s*$/, ""),
    ) as {
      launchId: string;
      values: Record<string, string>;
      entry: string;
      totalSeconds: number;
    };
    expect(config.launchId).toBe(launchId);
    expect(config.values).toEqual({ "cmi.location": "slide-4" });
    expect(config.entry).toBe("resume");
    expect(config.totalSeconds).toBe(120);

    const progress = await learnerTx((tx) => getModuleScormProgressForLearner(tx, ctx, moduleId));
    expect(progress.data.cmi).not.toHaveProperty("atlas.total_time_seconds");
  });

  it("re-authorizes every file: enrollment, membership, publication and package version", async () => {
    const { contentUrl } = await launch();
    const asset = sibling(contentUrl, "course%20content/js/app.js");
    const status = async () => (await fetchPackage(asset)).status;
    expect(await status()).toBe(200);

    const toggle = async (statement: (tx: TenantTx) => Promise<unknown>) => {
      await ownerTx(statement);
    };
    await toggle(
      (tx) =>
        tx.$executeRaw`update enrollments set status = 'cancelled' where course_id = ${fixture.draftCourseId}::uuid and membership_id = ${fixture.learnerMembershipId}::uuid`,
    );
    expect(await status()).toBe(404);
    await toggle(
      (tx) =>
        tx.$executeRaw`update enrollments set status = 'active' where course_id = ${fixture.draftCourseId}::uuid and membership_id = ${fixture.learnerMembershipId}::uuid`,
    );
    expect(await status()).toBe(200);

    await toggle(
      (tx) =>
        tx.$executeRaw`update memberships set status = 'SUSPENDED' where id = ${fixture.learnerMembershipId}::uuid`,
    );
    expect(await status()).toBe(404);
    await toggle(
      (tx) =>
        tx.$executeRaw`update memberships set status = 'ACTIVE' where id = ${fixture.learnerMembershipId}::uuid`,
    );
    expect(await status()).toBe(200);

    await toggle(
      (tx) =>
        tx.$executeRaw`update course_modules set status = 'DRAFT' where id = ${moduleId}::uuid`,
    );
    expect(await status()).toBe(404);
    await toggle(
      (tx) =>
        tx.$executeRaw`update course_modules set status = 'PUBLISHED' where id = ${moduleId}::uuid`,
    );
    expect(await status()).toBe(200);

    // A republished package invalidates launches minted for the old one.
    const next = randomUUID();
    await toggle(
      (tx) =>
        tx.$executeRaw`update course_modules set scorm_content_version = ${next}::uuid where id = ${moduleId}::uuid`,
    );
    store("course content/js/app.js", "window.v2 = true;", next);
    expect(await status()).toBe(404);
    const relaunched = await launch();
    const fresh = await fetchPackage(sibling(relaunched.contentUrl, "course%20content/js/app.js"));
    expect(await fresh.text()).toBe("window.v2 = true;");
    contentVersion = next;
  });

  it("keeps concurrent commits, and never takes a completion away", async () => {
    const ctx = learnerCtx(fixture);
    await Promise.all([
      learnerTx((tx) =>
        recordModuleScormProgressForLearner(tx, ctx, moduleId, { cmi: { "cmi.score.raw": "40" } }),
      ),
      learnerTx((tx) =>
        recordModuleScormProgressForLearner(tx, ctx, moduleId, {
          cmi: { "cmi.progress_measure": "0.5" },
        }),
      ),
    ]);
    let progress = await learnerTx((tx) => getModuleScormProgressForLearner(tx, ctx, moduleId));
    expect(progress.data.cmi).toMatchObject({
      "cmi.score.raw": "40",
      "cmi.progress_measure": "0.5",
    });
    expect(progress.data).toMatchObject({ status: "in_progress", progressPct: 50 });

    await learnerTx((tx) =>
      recordModuleScormProgressForLearner(tx, ctx, moduleId, {
        cmi: { "cmi.success_status": "passed" },
      }),
    );
    await learnerTx((tx) =>
      recordModuleScormProgressForLearner(tx, ctx, moduleId, {
        cmi: { "cmi.success_status": "unknown", "cmi.completion_status": "incomplete" },
      }),
    );
    progress = await learnerTx((tx) => getModuleScormProgressForLearner(tx, ctx, moduleId));
    expect(progress.data).toMatchObject({ status: "completed", progressPct: 100 });
    expect(progress.data.completedAt).not.toBeNull();
  });
});
