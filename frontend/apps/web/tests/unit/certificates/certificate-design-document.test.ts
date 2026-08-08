import { describe, expect, it } from "vitest";
import {
  certificateDesignDocumentSchema,
  createEmptyDesignDocument,
} from "@atlas/contracts/certificates/certificate-design-document";

describe("createEmptyDesignDocument", () => {
  it("produces a document that parses against the schema", () => {
    const doc = createEmptyDesignDocument();
    const parsed = certificateDesignDocumentSchema.safeParse(doc);
    expect(parsed.success).toBe(true);
  });

  it("uses schema version 1 and an A4 landscape page", () => {
    const doc = createEmptyDesignDocument();
    expect(doc.schemaVersion).toBe(1);
    expect(doc.page.unit).toBe("mm");
    expect(doc.page.orientation).toBe("landscape");
    expect(doc.page.width).toBeGreaterThan(doc.page.height);
  });

  it("seeds a recipient-name text element bound to a variable", () => {
    const doc = createEmptyDesignDocument();
    const recipient = doc.elements.find((el) => el.id === "recipient-name");
    expect(recipient).toBeDefined();
    expect(recipient?.type).toBe("text");
    if (recipient?.type === "text") {
      expect(recipient.variableKey).toBe("recipient_name");
    }
    expect(doc.variables?.some((v) => v.key === "recipient_name")).toBe(true);
  });

  it("seeds a verification QR element", () => {
    const doc = createEmptyDesignDocument();
    const qr = doc.elements.find((el) => el.type === "qr");
    expect(qr).toBeDefined();
    if (qr?.type === "qr") {
      expect(qr.valueSource).toBe("verification_url");
    }
  });

  it("rejects an unknown top-level field (strict schema)", () => {
    const doc = createEmptyDesignDocument() as Record<string, unknown>;
    const parsed = certificateDesignDocumentSchema.safeParse({ ...doc, bogus: true });
    expect(parsed.success).toBe(false);
  });
});
