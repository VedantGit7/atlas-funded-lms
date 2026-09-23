import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const fontRoot = resolve(root, "frontend/apps/web/public/fonts/cormorant-garamond/v21");
const read = (path) => readFileSync(resolve(root, path), "utf8");

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
