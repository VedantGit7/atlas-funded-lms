import { describe, expect, it } from "vitest";
import { createElement } from "../../../frontend/apps/web/node_modules/react";
import { renderToStaticMarkup } from "../../../frontend/apps/web/node_modules/react-dom/server.node.js";
import { CertificateShareDialog } from "../../../frontend/apps/web/src/features/certificates/components/CertificateShareDialog";

describe("certificate sharing with protected verification pages", () => {
  it("offers direct and social links without advertising unsupported iframe embedding", () => {
    const html = renderToStaticMarkup(
      createElement(CertificateShareDialog, {
        share: {
          url: "https://academy.example.test/verify/credential-1",
          title: "Course certificate",
          recipient: "Learner",
          issuerName: "Academy",
        },
        onClose: () => undefined,
      }),
    );

    expect(html).toContain('aria-label="Verification link"');
    expect(html).toContain("https://academy.example.test/verify/credential-1");
    expect(html).toContain("https://www.linkedin.com/sharing/share-offsite/");
    expect(html).toContain("https://twitter.com/intent/tweet");
    expect(html).toContain("mailto:");
    expect(html).not.toMatch(/embed code|&lt;iframe|<iframe/i);
  });
});
