import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveDocumentTitle } from "../../../src/lib/branding/document-title";

describe("resolveDocumentTitle", () => {
  it("uses Atlas LMS on platform / unresolved hosts", () => {
    assert.equal(resolveDocumentTitle({}), "Atlas LMS");
    assert.equal(resolveDocumentTitle({ tenantId: null }), "Atlas LMS");
  });

  it("formats tenant public name as Name LMS", () => {
    assert.equal(
      resolveDocumentTitle({ tenantId: "t1", publicName: "FundedBeyond" }),
      "FundedBeyond LMS",
    );
  });

  it("strips trailing Academy / LMS before appending LMS", () => {
    assert.equal(
      resolveDocumentTitle({ tenantId: "t1", publicName: "FundedBeyond Academy" }),
      "FundedBeyond LMS",
    );
    assert.equal(
      resolveDocumentTitle({ tenantId: "t1", publicName: "FundedBeyond LMS" }),
      "FundedBeyond LMS",
    );
  });

  it("falls back to issuerName then humanized slug", () => {
    assert.equal(
      resolveDocumentTitle({ tenantId: "t1", issuerName: "Funded Beyond" }),
      "Funded Beyond LMS",
    );
    assert.equal(
      resolveDocumentTitle({ tenantId: "t1", tenantSlug: "fundedbeyond" }),
      "Fundedbeyond LMS",
    );
  });

  it("never returns Atlas LMS when tenantId is present", () => {
    assert.equal(resolveDocumentTitle({ tenantId: "t1" }), "Academy LMS");
  });
});
