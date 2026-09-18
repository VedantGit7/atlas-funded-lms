import AdmZip from "adm-zip";
import { describe, expect, it } from "vitest";
import {
  buildScormContentStorageKey,
  extractScormPackage,
  MAX_SCORM_ENTRIES,
  MAX_SCORM_ENTRY_BYTES,
  MAX_SCORM_TOTAL_BYTES,
} from "@atlas/storage/scorm-package-extract";

function buildSampleScormZip(): Buffer {
  const zip = new AdmZip();
  zip.addFile(
    "imsmanifest.xml",
    Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="MANIFEST" version="1.2"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
  <organizations default="ORG">
    <organization identifier="ORG">
      <title>Sample SCORM</title>
      <item identifier="ITEM" identifierref="RES">
        <title>Launch</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES" type="webcontent" adlcp:scormtype="sco" href="index.html">
      <file href="index.html" />
    </resource>
  </resources>
</manifest>`),
  );
  zip.addFile("index.html", Buffer.from("<!doctype html><html><body>SCORM</body></html>"));
  return zip.toBuffer();
}

describe("extractScormPackage", () => {
  it("extracts launch path and files from a SCORM zip", () => {
    const extracted = extractScormPackage(buildSampleScormZip());

    expect(extracted.launchPath).toBe("index.html");
    expect(extracted.scormVersion).toBe("1.2");
    expect(extracted.files.some((file) => file.relativePath === "index.html")).toBe(true);
  });

  // Regression: a 199.5 KB archive was measured expanding to 200 MB in memory
  // (~1026x). At the 100 MB upload limit that is ~100 GB — an OOM of the shared
  // API process, i.e. a cross-tenant denial of service from one upload.
  it("rejects a zip bomb without materialising it", () => {
    const zip = new AdmZip();
    zip.addFile("imsmanifest.xml", Buffer.from("<manifest/>"));
    zip.addFile("bomb.bin", Buffer.alloc(MAX_SCORM_ENTRY_BYTES + 1, 0));

    expect(() => extractScormPackage(zip.toBuffer())).toThrow("SCORM_ENTRY_TOO_LARGE");
  });

  // The aggregate case, and the one that actually matches the audit's proof: the
  // measured archive spread 200 MB across many files, none of them individually
  // over the per-entry cap. A build that kept only the per-entry and entry-count
  // checks would pass both tests above and still OOM on exactly the package that
  // was demonstrated.
  it("rejects a package whose entries only exceed the cap in aggregate", () => {
    const zip = new AdmZip();
    zip.addFile("imsmanifest.xml", Buffer.from("<manifest/>"));

    // Each entry sits just under MAX_SCORM_ENTRY_BYTES; together they clear
    // MAX_SCORM_TOTAL_BYTES. Zeros compress to almost nothing, so the archive
    // itself stays small -- which is the whole point of a bomb.
    const entryBytes = MAX_SCORM_ENTRY_BYTES - 1;
    const entries = Math.floor(MAX_SCORM_TOTAL_BYTES / entryBytes) + 1;
    const payload = Buffer.alloc(entryBytes, 0);

    for (let i = 0; i < entries; i += 1) {
      zip.addFile(`chunk${i}.bin`, payload);
    }

    expect(() => extractScormPackage(zip.toBuffer())).toThrow("SCORM_PACKAGE_TOO_LARGE");
  });

  it("rejects an archive with too many entries", () => {
    const zip = new AdmZip();
    zip.addFile("imsmanifest.xml", Buffer.from("<manifest/>"));
    for (let i = 0; i <= MAX_SCORM_ENTRIES; i += 1) {
      zip.addFile(`f${i}.txt`, Buffer.from("x"));
    }

    expect(() => extractScormPackage(zip.toBuffer())).toThrow("SCORM_TOO_MANY_ENTRIES");
  });
});

describe("buildScormContentStorageKey", () => {
  // Regression: the previous single-pass `../` strip was bypassable. These three
  // payloads were confirmed escaping the module prefix before the fix.
  it.each([
    "../secret",
    "....//secret",
    "....\\/secret",
    "a/../../b",
    "a/./../b",
    "..",
    "./..",
    "x/..",
    "C:/win",
  ])("rejects traversal payload %j", (payload) => {
    expect(() =>
      buildScormContentStorageKey({ tenantId: "T", moduleId: "M", relativePath: payload }),
    ).toThrow("SCORM_INVALID_PATH");
  });

  it("keeps every accepted path inside the module prefix", () => {
    const key = buildScormContentStorageKey({
      tenantId: "T",
      moduleId: "M",
      // Leading slashes are stripped by normalisation rather than rejected.
      relativePath: "/assets/app.js",
    });

    expect(key).toBe("tenants/T/modules/M/scorm/content/assets/app.js");
  });

  // "..." and "...." are ordinary directory names, not traversal. An earlier
  // probe flagged them only because it substring-matched ".." rather than
  // checking path segments.
  it.each([
    ["..../secret", "tenants/T/modules/M/scorm/content/..../secret"],
    ["..././secret", "tenants/T/modules/M/scorm/content/.../secret"],
  ])("treats dot-run %j as a normal segment", (payload, expected) => {
    expect(
      buildScormContentStorageKey({ tenantId: "T", moduleId: "M", relativePath: payload }),
    ).toBe(expected);
  });

  // Regression: SCORM manifests commonly use href="./index.html". Before the
  // fix, "." segments survived normalisation, so the launch path never matched
  // the extracted entry and the whole package failed with
  // SCORM_LAUNCH_FILE_NOT_FOUND.
  it.each([
    ["./index.html", "tenants/T/modules/M/scorm/content/index.html"],
    ["a/./b", "tenants/T/modules/M/scorm/content/a/b"],
  ])("normalises dot segment in %j", (payload, expected) => {
    expect(
      buildScormContentStorageKey({ tenantId: "T", moduleId: "M", relativePath: payload }),
    ).toBe(expected);
  });
});

describe("extractScormPackage launch path", () => {
  it('resolves a manifest href of "./index.html"', () => {
    const zip = new AdmZip();
    zip.addFile(
      "imsmanifest.xml",
      Buffer.from(
        `<?xml version="1.0"?><manifest>
         <organizations><organization><item identifierref="R1"/></organization></organizations>
         <resources><resource identifier="R1" href="./index.html"/></resources></manifest>`,
      ),
    );
    zip.addFile("index.html", Buffer.from("<html>ok</html>"));

    const extracted = extractScormPackage(zip.toBuffer());
    expect(extracted.launchPath).toBe("index.html");
  });
});
