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
      resolveDocumentTitle({ tenantId: "t1", publicName: "Northwind" }),
      "Northwind LMS",
    );
  });

  it("strips trailing Academy / LMS before appending LMS", () => {
    assert.equal(
      resolveDocumentTitle({ tenantId: "t1", publicName: "Northwind Academy" }),
      "Northwind LMS",
    );
    assert.equal(
      resolveDocumentTitle({ tenantId: "t1", publicName: "Northwind LMS" }),
      "Northwind LMS",
    );
  });

  it("falls back to issuerName then humanized slug", () => {
    assert.equal(
      resolveDocumentTitle({ tenantId: "t1", issuerName: "North Wind" }),
      "North Wind LMS",
    );
    assert.equal(
      resolveDocumentTitle({ tenantId: "t1", tenantSlug: "northwind" }),
      "Northwind LMS",
    );
  });

  it("never returns Atlas LMS when tenantId is present", () => {
    assert.equal(resolveDocumentTitle({ tenantId: "t1" }), "Academy LMS");
  });
});
