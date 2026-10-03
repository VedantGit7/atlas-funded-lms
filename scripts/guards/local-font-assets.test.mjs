import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const fontRoot = resolve(root, "frontend/apps/web/public/fonts/cormorant-garamond/v21");
const read = (path) => readFileSync(resolve(root, path), "utf8");

test("application builds have no remote Google font transformer dependencies", () => {
  const src = resolve(root, "frontend/apps/web/src");
  for (const name of readdirSync(src, { recursive: true })) {
    if (/\.[jt]sx?$/.test(name)) {
      assert.doesNotMatch(
        readFileSync(resolve(src, name), "utf8"),
        /from\s+["']next\/font\/google["']/,
        name,
      );
    }
  }
});

for (const [slug, version, faces, assets] of [
  ["plus-jakarta-sans", "v12", 4, 4],
  ["jetbrains-mono", "v24", 12, 6],
  ["inter", "v20", 28, 7],
  ["playfair-display", "v40", 4, 4],
]) {
  test(`${slug} preserves licensed bytes, face coverage, fallback metrics and immutable paths`, () => {
    const dir = resolve(root, `frontend/apps/web/public/fonts/${slug}/${version}`);
    const manifest = JSON.parse(readFileSync(resolve(dir, "manifest.json"), "utf8"));
    const css = read(`frontend/apps/web/src/styles/${slug}.css`);
    assert.equal(manifest.assets.length, assets);
    assert.equal([...css.matchAll(/@font-face/g)].length, faces + 1);
    assert.doesNotMatch(css, /https?:\/\//);
    const license = readFileSync(resolve(dir, "OFL.txt"));
    assert.match(license.toString(), /SIL OPEN FONT LICENSE/);
    assert.equal(createHash("sha256").update(license).digest("hex"), manifest.licenseSha256);
    for (const asset of manifest.assets) {
      const bytes = readFileSync(resolve(dir, asset.file));
      assert.equal(bytes.subarray(0, 4).toString(), "wOF2");
      assert.equal(createHash("sha256").update(bytes).digest("hex"), asset.sha256);
      assert.equal(bytes.length, asset.bytes);
      assert.ok(asset.file.includes(asset.sha256.slice(0, 12)));
      assert.ok(css.includes(`/fonts/${slug}/${version}/${asset.file}`));
      assert.equal(asset.preload, asset.subset === "latin");
    }
    for (const [cssKey, key] of [
      ["ascent-override", "ascentOverride"],
      ["descent-override", "descentOverride"],
      ["line-gap-override", "lineGapOverride"],
      ["size-adjust", "sizeAdjust"],
    ]) {
      const value = css.match(new RegExp(`${cssKey}: ([0-9.]+)%`))?.[1];
      assert.equal(Number(value), Number.parseFloat(manifest.metrics[key]));
    }
    assert.ok(
      read("frontend/apps/web/next.config.ts").includes(`/fonts/${slug}/${version}/:path*`),
    );
    const rootLayout = read("frontend/apps/web/src/app/layout.tsx");
    const studio = read(
      "frontend/apps/web/src/features/certificates/certificate-builder/studio-home.tsx",
    );
    const studioOnly = slug === "inter" || slug === "playfair-display";
    const scope = studioOnly ? studio : rootLayout;
    const preloads = [...scope.matchAll(/href="(\/fonts\/[^"]+)"/g)]
      .map((m) => m[1])
      .filter((p) => p.startsWith(`/fonts/${slug}/`));
    assert.deepEqual(
      preloads,
      manifest.assets.filter((a) => a.preload).map((a) => `/fonts/${slug}/${version}/${a.file}`),
    );
    if (studioOnly) assert.ok(!rootLayout.includes(`/fonts/${slug}/`));
  });
}

test("Cormorant builds use checked-in assets instead of Google's font query transformer", () => {
  for (const file of [
    "frontend/apps/web/src/app/layout.tsx",
    "frontend/apps/web/src/features/certificates/certificate-builder/studio-templates.tsx",
  ]) {
    const source = read(file);
    assert.doesNotMatch(source, /Cormorant_Garamond/);
    assert.match(source, /font-cormorant/);
  }
  assert.match(read("frontend/apps/web/src/app/layout.tsx"), /cormorant-garamond\.css/);
});

test("vendored font bytes, subsets and redistribution license remain intact", () => {
  const manifest = JSON.parse(readFileSync(resolve(fontRoot, "manifest.json"), "utf8"));
  assert.equal(manifest.assets.length, 10);
  assert.match(readFileSync(resolve(fontRoot, "OFL.txt"), "utf8"), /SIL OPEN FONT LICENSE/);
  const css = read("frontend/apps/web/src/styles/cormorant-garamond.css");
  assert.doesNotMatch(css, /https?:\/\//);
  // The certificate inspector selects this literal family, independently of the CSS variable.
  assert.match(css, /font-family: "Cormorant Garamond";/);
  assert.match(css, /--font-cormorant: "Cormorant Garamond", "Cormorant Garamond Fallback";/);
  const faces = [...css.matchAll(/@font-face\s*\{([^}]+)\}/g)].map((m) => m[1]);
  for (const asset of manifest.assets) {
    assert.match(
      asset.file,
      /^(normal|italic)-(latin|latin-ext|vietnamese|cyrillic|cyrillic-ext)\.[a-f0-9]{12}\.woff2$/,
    );
    const bytes = readFileSync(resolve(fontRoot, asset.file));
    assert.equal(bytes.subarray(0, 4).toString(), "wOF2");
    assert.equal(createHash("sha256").update(bytes).digest("hex"), asset.sha256);
    const matches = faces.filter((face) => face.includes(asset.file));
    assert.equal(matches.length, 3, asset.file);
    for (const weight of [500, 600, 700]) {
      assert.ok(matches.some((face) => face.includes(`font-weight: ${weight};`)));
    }
    for (const face of matches) {
      assert.ok(face.includes(`font-style: ${asset.style};`));
      assert.match(face, /unicode-range:\s+U\+/);
      assert.match(face, /font-display: swap/);
    }
  }
  assert.match(css, /ascent-override: 95\.27%/);
  assert.match(css, /descent-override: 29\.59%/);
  assert.match(css, /size-adjust: 96\.98%/);
});

test("only the existing two Latin subsets are preloaded and public caching is version scoped", () => {
  const manifest = JSON.parse(readFileSync(resolve(fontRoot, "manifest.json"), "utf8"));
  const layout = read("frontend/apps/web/src/app/layout.tsx");
  const preloads = [...layout.matchAll(/href="(\/fonts\/cormorant-garamond\/v21\/[^"]+)"/g)].map(
    (m) => m[1],
  );
  assert.equal(preloads.length, 2);
  assert.deepEqual(
    preloads.sort(),
    manifest.assets
      .filter((a) => a.subset === "latin")
      .map((a) => `/fonts/cormorant-garamond/v21/${a.file}`)
      .sort(),
  );
  assert.ok(manifest.assets.filter((a) => a.preload).reduce((sum, a) => sum + a.bytes, 0) <= 77100);
  const config = read("frontend/apps/web/next.config.ts");
  assert.match(config, /source: "\/fonts\/cormorant-garamond\/v21\/:path\*"/);
  assert.match(config, /public, max-age=31536000, immutable/);
});
