import type DOMPurifyInstance from "isomorphic-dompurify";

type Purifier = typeof DOMPurifyInstance;

/**
 * Make an uploaded SVG inert (audit M8).
 *
 * SVG is XML that can carry script: `<script>`, event-handler attributes,
 * `javascript:` links, `<foreignObject>` with HTML, and `@import` or `url()`
 * that load from elsewhere. Branding, favicons and lesson thumbnails accept
 * SVG, and an SVG opened directly runs its script in the origin it is served
 * from. We keep the vector, but only after DOMPurify's SVG profile has removed
 * all of that, with two additions:
 *
 * - `href`, `xlink:href` and `src` may only point inside the document (`#id`)
 *   or at an inline raster image, never at a URL;
 * - CSS in `<style>` and `style` loses `@import` and any non-local `url()`.
 *
 * The result is written back over the upload, and is served with
 * `Content-Disposition: attachment` as well (see content-disposition.ts).
 *
 * DOMPurify runs on jsdom, which is slow to load, so it is imported on first
 * use rather than with the storage package.
 */

const LOCAL_REFERENCE = /^(?:#|data:image\/(?:png|jpe?g|gif|webp);base64,)/i;
const URL_ATTRIBUTES = new Set(["href", "xlink:href", "src"]);

function neutraliseCss(css: string): string {
  return css
    .replace(/@import[^;]*;?/gi, "")
    .replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi, (match, _quote: string, target: string) =>
      LOCAL_REFERENCE.test(target.trim()) ? match : "none",
    );
}

let purifier: Promise<Purifier> | null = null;
function loadPurifier(): Promise<Purifier> {
  purifier ??= import("isomorphic-dompurify").then(({ default: DOMPurify }) => {
    installHooks(DOMPurify);
    return DOMPurify;
  });
  return purifier;
}

function installHooks(DOMPurify: Purifier) {
  DOMPurify.addHook("uponSanitizeAttribute", (_node, data) => {
    const name = data.attrName.toLowerCase();
    if (URL_ATTRIBUTES.has(name) && !LOCAL_REFERENCE.test(data.attrValue.trim())) {
      data.keepAttr = false;
    }
    if (name === "style") data.attrValue = neutraliseCss(data.attrValue);
  });
  DOMPurify.addHook("uponSanitizeElement", (node, data) => {
    if (data.tagName === "style" && node.textContent) {
      node.textContent = neutraliseCss(node.textContent);
    }
  });
}

/** XML declaration and DOCTYPE (with any internal subset, which can declare entities). */
function stripProlog(svg: string): string {
  return svg
    .replace(/^\uFEFF/, "")
    .replace(/<\?xml[\s\S]*?\?>/gi, "")
    .replace(/<!DOCTYPE[^>[]*(\[[\s\S]*?\])?\s*>/gi, "")
    .trim();
}

export class SvgSanitizeError extends Error {
  constructor() {
    super("ASSET_SVG_INVALID");
    this.name = "SvgSanitizeError";
  }
}

export async function sanitizeSvg(input: Buffer): Promise<Buffer> {
  const DOMPurify = await loadPurifier();
  const cleaned = DOMPurify.sanitize(stripProlog(input.toString("utf8")), {
    USE_PROFILES: { svg: true, svgFilters: true },
    // Safe once its reference is confined to the document by the hook above.
    ADD_TAGS: ["use"],
  })
    // The HTML serializer writes U+00A0 as &nbsp;, which is not an XML entity.
    .replace(/&nbsp;/g, "&#160;")
    .trim();

  if (!cleaned.startsWith("<svg")) throw new SvgSanitizeError();
  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>\n${cleaned}\n`, "utf8");
}
