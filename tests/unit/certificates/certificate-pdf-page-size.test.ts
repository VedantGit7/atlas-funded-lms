import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockLaunch, mockPdf, mockSetContent, mockClose } = vi.hoisted(() => ({
  mockLaunch: vi.fn(),
  mockPdf: vi.fn(),
  mockSetContent: vi.fn(),
  mockClose: vi.fn(),
}));

// playwright-core is only installed for the API app, so mock it at that path.
vi.mock("../../../backend/apps/api/node_modules/playwright-core", () => ({
  chromium: { launch: (...args: unknown[]) => mockLaunch(...args) },
}));

import { createEmptyDesignDocument } from "../../../backend/apps/api/src/server/certificates/certificate-design-document";
import type { CertificateDesignDocument } from "../../../backend/apps/api/src/server/certificates/certificate-design-document";
import {
  CertificatePdfUnavailableError,
  renderCertificatePdfBuffer,
} from "../../../backend/apps/api/src/server/certificates/certificate-pdf.service";

const zeroMargin = { top: "0", right: "0", bottom: "0", left: "0" };

function designWithPage(
  page: Partial<CertificateDesignDocument["page"]>,
): CertificateDesignDocument {
  const doc = createEmptyDesignDocument();
  return { ...doc, page: { ...doc.page, ...page } };
}

async function renderAndCapture(
  doc: CertificateDesignDocument,
): Promise<{ options: Record<string, unknown>; html: string }> {
  await renderCertificatePdfBuffer({ designSnapshotJson: doc });
  expect(mockPdf).toHaveBeenCalledTimes(1);
  const [options] = mockPdf.mock.lastCall ?? [];
  const [html] = mockSetContent.mock.lastCall ?? [];
  return { options: options as Record<string, unknown>, html: html as string };
}

describe("renderCertificatePdfBuffer page.pdf options", () => {
  beforeEach(() => {
    mockLaunch.mockReset();
    mockPdf.mockReset();
    mockSetContent.mockReset();
    mockClose.mockReset();
    mockPdf.mockResolvedValue(Buffer.from("%PDF-1.4 mock"));
    mockSetContent.mockResolvedValue(undefined);
    mockClose.mockResolvedValue(undefined);
    mockLaunch.mockResolvedValue({
      newPage: async () => ({ setContent: mockSetContent, pdf: mockPdf }),
      close: mockClose,
    });
  });

  it("sizes the default landscape mm design to 297×210mm with zero margins", async () => {
    const { options, html } = await renderAndCapture(createEmptyDesignDocument());

    expect(options).toEqual({
      width: "297mm",
      height: "210mm",
      printBackground: true,
      margin: zeroMargin,
      pageRanges: "1",
    });
    expect(options).not.toHaveProperty("format");
    expect(options).not.toHaveProperty("landscape");
    expect(options).not.toHaveProperty("preferCSSPageSize");
    expect(html).toContain("@page { size: 297mm 210mm; margin: 0; }");
    // Without size containment, an element wholly off the page makes Chromium
    // shrink the certificate to fit (seen at 0.87x after an orientation flip).
    expect(html).toContain("contain: strict;");
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it("keeps portrait designs portrait", async () => {
    const { options, html } = await renderAndCapture(
      designWithPage({ width: 210, height: 297, orientation: "portrait" }),
    );

    expect(options).toMatchObject({ width: "210mm", height: "297mm", margin: zeroMargin });
    expect(html).toContain("@page { size: 210mm 297mm; margin: 0; }");
  });

  it("passes px designs through in px", async () => {
    const { options } = await renderAndCapture(
      designWithPage({ width: 1123, height: 794, unit: "px" }),
    );

    expect(options).toMatchObject({ width: "1123px", height: "794px", margin: zeroMargin });
  });

  it("passes inch designs through in inches", async () => {
    const { options } = await renderAndCapture(
      designWithPage({ width: 11, height: 8.5, unit: "in" }),
    );

    expect(options).toMatchObject({ width: "11in", height: "8.5in", margin: zeroMargin });
  });

  it("does not grow the page by the bleed", async () => {
    const { options } = await renderAndCapture(designWithPage({ bleedMm: 3 }));

    expect(options).toMatchObject({ width: "297mm", height: "210mm" });
  });

  it("still maps launch failures to CertificatePdfUnavailableError", async () => {
    mockLaunch.mockRejectedValue(new Error("no chromium"));

    await expect(
      renderCertificatePdfBuffer({ designSnapshotJson: createEmptyDesignDocument() }),
    ).rejects.toThrow(CertificatePdfUnavailableError);
    expect(mockPdf).not.toHaveBeenCalled();
  });
});
