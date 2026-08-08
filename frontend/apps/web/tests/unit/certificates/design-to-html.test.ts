import { describe, expect, it, vi } from "vitest";
import type { CertificateDesignDocument } from "@atlas/contracts/certificates/certificate-design-document";
import {
  designDocumentToHtml,
  designDocumentToHtmlAsync,
  sampleDataFromVariables,
} from "../../../src/features/certificates/certificate-builder/render/design-to-html";

// The renderer imports `qrcode` at module scope. Mock it so the async path is
// deterministic and does not depend on the native encoder.
vi.mock("qrcode", () => ({
  default: {
    toDataURL: vi.fn(async () => "data:image/png;base64,QRSTUB"),
  },
}));

function baseDocument(
  overrides: Partial<CertificateDesignDocument> = {},
): CertificateDesignDocument {
  return {
    schemaVersion: 1,
    page: { width: 800, height: 600, unit: "px", orientation: "landscape" },
    background: { type: "color", value: "#ffffff" },
    elements: [],
    ...overrides,
  };
}

describe("designDocumentToHtml — escaping", () => {
  it("escapes HTML in static text content", () => {
    const doc = baseDocument({
      elements: [
        {
          id: "t1",
          type: "text",
          x: 0,
          y: 0,
          width: 200,
          height: 40,
          zIndex: 1,
          text: `<script>alert("x")</script> & 'end'`,
          fontFamily: "Georgia, serif",
          fontSize: 18,
          fontWeight: 400,
          color: "#000000",
          align: "left",
        },
      ],
    });

    const html = designDocumentToHtml(doc, {});
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp;");
    expect(html).toContain("&#39;end&#39;");
  });

  it("escapes a malicious font-family value into the style attribute", () => {
    const doc = baseDocument({
      elements: [
        {
          id: "t1",
          type: "text",
          x: 0,
          y: 0,
          width: 200,
          height: 40,
          zIndex: 1,
          text: "Hello",
          fontFamily: `"><img src=x onerror=alert(1)>`,
          fontSize: 18,
          fontWeight: 400,
          color: "#000000",
          align: "left",
        },
      ],
    });

    const html = designDocumentToHtml(doc, {});
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img");
  });
});

describe("designDocumentToHtml — variable substitution", () => {
  it("substitutes a bound variableKey from merge data (escaped)", () => {
    const doc = baseDocument({
      elements: [
        {
          id: "t1",
          type: "text",
          x: 0,
          y: 0,
          width: 200,
          height: 40,
          zIndex: 1,
          text: "{{name}}",
          fontFamily: "Georgia, serif",
          fontSize: 18,
          fontWeight: 400,
          color: "#000000",
          align: "left",
          variableKey: "name",
        },
      ],
    });

    const html = designDocumentToHtml(doc, { name: "Jane <Doe>" });
    expect(html).toContain("Jane &lt;Doe&gt;");
    expect(html).not.toContain("{{name}}");
  });

  it("substitutes {{token}} placeholders inside static text", () => {
    const doc = baseDocument({
      elements: [
        {
          id: "t1",
          type: "text",
          x: 0,
          y: 0,
          width: 300,
          height: 40,
          zIndex: 1,
          text: "Awarded for {{course}}",
          fontFamily: "Georgia, serif",
          fontSize: 18,
          fontWeight: 400,
          color: "#000000",
          align: "left",
        },
      ],
    });

    const html = designDocumentToHtml(doc, { course: "Trading 101" });
    expect(html).toContain("Awarded for Trading 101");
  });

  it("falls back to a variable sampleValue when no data is provided", () => {
    const doc = baseDocument({
      variables: [{ key: "name", label: "Name", sampleValue: "Sample Person" }],
      elements: [
        {
          id: "t1",
          type: "text",
          x: 0,
          y: 0,
          width: 200,
          height: 40,
          zIndex: 1,
          text: "{{name}}",
          fontFamily: "Georgia, serif",
          fontSize: 18,
          fontWeight: 400,
          color: "#000000",
          align: "left",
          variableKey: "name",
        },
      ],
    });

    const html = designDocumentToHtml(doc, {});
    expect(html).toContain("Sample Person");
  });
});

describe("sampleDataFromVariables", () => {
  it("derives sample data and always includes verification defaults", () => {
    const doc = baseDocument({
      variables: [
        { key: "name", label: "Name", sampleValue: "Jane" },
        { key: "course", label: "Course" },
      ],
    });
    const data = sampleDataFromVariables(doc);
    expect(data["name"]).toBe("Jane");
    // No sampleValue → falls back to label.
    expect(data["course"]).toBe("Course");
    expect(data["verification_url"]).toBeTruthy();
    expect(data["credential_id"]).toBeTruthy();
  });
});

describe("designDocumentToHtmlAsync — QR rendering (mocked)", () => {
  it("renders a QR element as an image using the mocked data URL", async () => {
    const doc = baseDocument({
      elements: [
        {
          id: "qr1",
          type: "qr",
          x: 0,
          y: 0,
          width: 96,
          height: 96,
          zIndex: 1,
          valueSource: "verification_url",
        },
      ],
    });

    const html = await designDocumentToHtmlAsync(doc, {
      verification_url: "https://verify.example.com/cred_123",
    });
    expect(html).toContain("data:image/png;base64,QRSTUB");
    expect(html).toContain('data-type="qr"');
  });
});
