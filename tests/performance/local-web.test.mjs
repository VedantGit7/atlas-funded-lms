import { test } from "node:test";
import assert from "node:assert/strict";
import { localWebEnvironment } from "../../scripts/perf/local-web.mjs";

test("local production web cannot inherit hosted service endpoints or privileged owner DB", () => {
  const env = localWebEnvironment({
    PATH: "runtime",
    DATABASE_URL: "postgres://hosted.invalid/prod",
    SENTRY_DSN: "https://hosted.invalid",
    NEXT_PUBLIC_SUPABASE_URL: "https://hosted.invalid",
    NODE_OPTIONS: "--require hosted-hook",
  });
  assert.equal(env.PATH, "runtime");
  assert.ok(!env.SENTRY_DSN);
  assert.equal(env.NODE_OPTIONS, undefined);
  assert.equal(env.NODE_ENV, "production");
  assert.equal(env.ATLAS_PERF_BUILD, "1");
  assert.equal(env.NEXT_PUBLIC_SUPABASE_URL, "http://127.0.0.1:54326");
  assert.match(env.DATABASE_URL, /atlas_app_login:.*@127\.0\.0\.1:15436\/atlas_lms_e2e/);
  assert.match(
    env.PLATFORM_DATABASE_URL,
    /atlas_platform_login:.*@127\.0\.0\.1:15436\/atlas_lms_e2e/,
  );
});
