import { describe, expect, it } from "vitest";
import { assertContentMatchesDeclaredType, sniffContent } from "@atlas/storage/content-sniff";
import { contentDispositionFor } from "@atlas/storage/content-disposition";
import { SvgSanitizeError, sanitizeSvg } from "@atlas/storage/svg-sanitize";
import { assertAllowedMimeType } from "@atlas/storage/mime-policy";
import { R2StorageProvider } from "@atlas/storage/providers/r2-storage-provider";

/** Audit M8: upload bytes are checked, SVG is made inert, and risky types download. */

const bytes = (...values: number[]) => Buffer.concat([Buffer.from(values), Buffer.alloc(32)]);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBPVP8 ")]);
const ICO = bytes(0x00, 0x00, 0x01, 0x00);
const PDF = Buffer.from("%PDF-1.7\n%âãÏÓ\n");
const ZIP = bytes(0x50, 0x4b, 0x03, 0x04);
const OLE = bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1);
const MP3 = Buffer.concat([Buffer.from("ID3"), Buffer.alloc(16)]);
const HTML = Buffer.from("<!DOCTYPE html><html><body><script>alert(1)</script></body></html>");
const SVG = Buffer.from(
  '<?xml version="1.0"?>\n<!-- logo -->\n<svg xmlns="http://www.w3.org/2000/svg"></svg>',
);
const ELF = bytes(0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00);

describe("content sniffing", () => {
  it("recognises each accepted format by its signature", () => {
    expect(sniffContent(PNG)).toBe("png");
    expect(sniffContent(JPEG)).toBe("jpeg");
    expect(sniffContent(WEBP)).toBe("webp");
    expect(sniffContent(ICO)).toBe("ico");
    expect(sniffContent(PDF)).toBe("pdf");
    expect(sniffContent(ZIP)).toBe("zip");
    expect(sniffContent(OLE)).toBe("ole");
    expect(sniffContent(MP3)).toBe("audio");
    expect(sniffContent(SVG)).toBe("svg");
    expect(sniffContent(HTML)).toBe("markup");
    expect(sniffContent(Buffer.from("name,score\nada,90\n"))).toBe("text");
    expect(sniffContent(ELF)).toBe("binary");
  });

  it("accepts a file that is what it says it is", () => {
    for (const [type, head] of [
      ["image/png", PNG],
      ["image/jpeg", JPEG],
      ["image/webp", WEBP],
      ["image/x-icon", ICO],
      ["image/x-icon", PNG],
      ["image/svg+xml", SVG],
      ["application/pdf", PDF],
      ["application/zip", ZIP],
      ["application/vnd.openxmlformats-officedocument.presentationml.presentation", ZIP],
      ["application/vnd.ms-powerpoint", OLE],
      ["audio/mpeg", MP3],
      ["text/csv", Buffer.from("a,b\n1,2\n")],
      ["text/plain", Buffer.from([0xff, 0xfe, 0x61, 0x00])],
    ] as const) {
      expect(
        () => assertContentMatchesDeclaredType({ declaredType: type, head }),
        type,
      ).not.toThrow();
    }
  });

  it("refuses HTML, script or a binary disguised as an accepted type", () => {
    for (const [type, head] of [
      ["image/png", HTML],
      ["image/jpeg", SVG],
      ["image/svg+xml", HTML],
      ["application/pdf", ELF],
      ["text/plain", HTML],
      ["text/csv", ELF],
      ["audio/mpeg", HTML],
      ["application/zip", PDF],
      // UTF-16 markup is still markup.
      ["text/plain", Buffer.from("\uFEFF<html><script>x</script>", "utf16le")],
    ] as const) {
      expect(() => assertContentMatchesDeclaredType({ declaredType: type, head }), type).toThrow(
        "ASSET_CONTENT_MISMATCH",
      );
    }
  });
});

describe("SVG sanitizing", () => {
  it("removes script, handlers, foreign content, external references and CSS imports", async () => {
    const evil = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(2)</script>` +
        `<foreignObject><iframe src="javascript:alert(3)"></iframe></foreignObject>` +
        `<a href="javascript:alert(4)"><rect width="5" height="5" style="fill:url(https://evil.example/f)"/></a>` +
        `<image href="https://evil.example/x.png"/>` +
        `<style>@import url(https://evil.example/x.css); .b{background:url('https://evil.example/y')}</style></svg>`,
    );
    const out = (await sanitizeSvg(evil)).toString("utf8");
    expect(out).not.toMatch(
      /script|onload|foreignObject|iframe|javascript:|evil\.example|@import/i,
    );
    expect(out).toContain("<rect");
  });

  it("keeps an ordinary logo intact, as standalone XML", async () => {
    const logo = Buffer.from(
      `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n` +
        `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 10 10">` +
        `<defs><linearGradient id="g"><stop offset="0" stop-color="#f00"/></linearGradient></defs>` +
        `<rect id="r" width="10" height="10" fill="url(#g)"/><use xlink:href="#r"/><text>A&#160;B</text></svg>`,
    );
    const out = (await sanitizeSvg(logo)).toString("utf8");
    expect(out.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(out).toContain('viewBox="0 0 10 10"');
    expect(out).toContain("<linearGradient");
    expect(out).toContain('fill="url(#g)"');
    expect(out).toContain('<use xlink:href="#r"');
    expect(out).not.toContain("&nbsp;");
    expect(out).not.toContain("DOCTYPE");
  });

  it("refuses a file that is not an SVG at all", async () => {
    await expect(sanitizeSvg(HTML)).rejects.toBeInstanceOf(SvgSanitizeError);
  });
});

describe("presentation policy", () => {
  it("lets raster images, audio and PDF show inline and downloads everything else", () => {
    for (const type of ["image/png", "image/jpeg", "image/webp", "audio/mpeg", "application/pdf"]) {
      expect(contentDispositionFor(type, "f"), type).toBeNull();
    }
    for (const type of ["image/svg+xml", "text/plain", "text/csv", "application/zip"]) {
      expect(contentDispositionFor(type, "f.x"), type).toMatch(/^attachment; filename="f\.x"/);
    }
  });

  it("keeps a hostile file name inside the header value", () => {
    const header = contentDispositionFor("text/plain", 'a"; evil=1\r\n.txt') ?? "";
    expect(header).not.toMatch(/[\r\n]/);
    expect(header.startsWith('attachment; filename="a_; evil=1__.txt"')).toBe(true);
  });

  it("refuses SVG as an OG image, which is always public", () => {
    expect(() =>
      assertAllowedMimeType({ purpose: "branding.og-image", contentType: "image/svg+xml" }),
    ).toThrow("UNSUPPORTED_BRANDING_ASSET_TYPE");
    expect(() =>
      assertAllowedMimeType({ purpose: "branding.logo", contentType: "image/svg+xml" }),
    ).not.toThrow();
  });
});

describe("R2 signed URLs", () => {
  const provider = new R2StorageProvider({
    R2_ACCOUNT_ID: "account",
    R2_ACCESS_KEY_ID: "key",
    R2_SECRET_ACCESS_KEY: "secret",
  } as never);

  it("binds the declared type and disposition into the upload signature", async () => {
    const upload = await provider.createSignedUploadUrl({
      bucket: "b",
      key: "k.svg",
      contentType: "image/svg+xml",
      sizeBytes: 10,
      contentDisposition: 'attachment; filename="k.svg"',
      expiresInSeconds: 60,
    });
    const signed = new URL(upload.url).searchParams.get("X-Amz-SignedHeaders")?.split(";") ?? [];
    expect(signed).toEqual(expect.arrayContaining(["content-type", "content-disposition"]));
    expect(upload.requiredHeaders).toEqual({
      "content-type": "image/svg+xml",
      "content-disposition": 'attachment; filename="k.svg"',
    });
  });

  it("forces the response type and disposition on signed downloads", async () => {
    const download = await provider.createSignedDownloadUrl({
      bucket: "b",
      key: "k.svg",
      expiresInSeconds: 60,
      responseContentDisposition: 'attachment; filename="k.svg"',
      responseContentType: "image/svg+xml",
    });
    const params = new URL(download.url).searchParams;
    expect(params.get("response-content-disposition")).toBe('attachment; filename="k.svg"');
    expect(params.get("response-content-type")).toBe("image/svg+xml");
  });
});
