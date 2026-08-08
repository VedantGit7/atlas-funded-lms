import { describe, expect, it } from "vitest";
import { extractScormPackage } from "@atlas/storage/scorm-package-extract";

function buildSampleScormZip(): Buffer {
  const AdmZip = require("adm-zip") as typeof import("adm-zip");
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
  zip.addFile(
    "index.html",
    Buffer.from("<!doctype html><html><body>SCORM</body></html>"),
  );
  return zip.toBuffer();
}

describe("extractScormPackage", () => {
  it("extracts launch path and files from a SCORM zip", () => {
    const extracted = extractScormPackage(buildSampleScormZip());

    expect(extracted.launchPath).toBe("index.html");
    expect(extracted.scormVersion).toBe("1.2");
    expect(extracted.files.some((file) => file.relativePath === "index.html")).toBe(true);
  });
});
