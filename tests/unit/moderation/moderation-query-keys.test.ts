import { describe, expect, it } from "vitest";
import {
  moderationAppealsQueryKey,
  moderationCaseDetailQueryKey,
  moderationCasesQueryKey,
  moderationSpacesQueryKey,
} from "../../../frontend/apps/web/src/features/moderation/moderation-query-keys";

describe("moderation tenant query keys", () => {
  it("scopes moderation keys by tenant host scope", () => {
    const tenantA = moderationCasesQueryKey("tenant-a.example", { view: "cases" });
    const tenantB = moderationCasesQueryKey("tenant-b.example", { view: "cases" });
    expect(tenantA).not.toEqual(tenantB);
  });

  it("uses distinct keys for case detail appeals and spaces", () => {
    const scope = "tenant-a.example";
    expect(moderationCaseDetailQueryKey(scope, "case-id")).not.toEqual(
      moderationAppealsQueryKey(scope),
    );
    expect(moderationSpacesQueryKey(scope)).not.toEqual(moderationCasesQueryKey(scope));
  });
});
