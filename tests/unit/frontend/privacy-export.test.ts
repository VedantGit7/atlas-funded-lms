import { describe, expect, it, vi } from "vitest";
import { loadProfileExport } from "../../../frontend/apps/web/src/features/learner/profile-export";
import { deletionOutcomeLabel } from "../../../frontend/apps/web/src/features/data-rights/deletion-requests-admin-utils";
import type { DeletionRequestItem } from "../../../frontend/apps/web/src/features/data-rights/api";
import { createElement } from "../../../frontend/apps/web/node_modules/react";
import { renderToStaticMarkup } from "../../../frontend/apps/web/node_modules/react-dom/server.node.js";
import { AccountDeletionCard } from "../../../frontend/apps/web/src/features/data-rights/components/account-deletion-card";
import { PrivacyDataForm } from "../../../frontend/apps/web/src/features/learner/components/PrivacyDataForm";
import { DeletionRequestsAdmin } from "../../../frontend/apps/web/src/features/data-rights/components/deletion-requests-admin";
import { ExportsAdmin } from "../../../frontend/apps/web/src/features/data-rights/components/exports-admin";

// Render screen-owned copy without requiring a compiled design-system package.
vi.mock("@atlas/design-system", () => ({
  dropdownPanelEnterClassName: "",
  EmptyState: ({ title, description }: { title: string; description: string }) =>
    `${title} ${description}`,
}));

describe("truthful partial profile export", () => {
  const data = {
    "/api/v1/me": { identity: { email: "learner@example.test" } },
    "/api/v1/members/member-1/profile": { bio: null, links: [], "custom/key": true },
    "/api/v1/me/preferences": { privacy: { analyticsConsent: false } },
    "/api/v1/entitlements": [],
  };

  it("lists actual categories and JSON Pointer fields, including empty and null values", async () => {
    const get = vi.fn(async (url: string) => ({ data: data[url as keyof typeof data] }));
    const bundle = await loadProfileExport("member-1", get);
    expect(bundle.manifest.completeDataRightsExport).toBe(false);
    expect(bundle.manifest.scope).toBe("partial_profile_snapshot");
    expect(bundle.manifest.included.map((item) => item.category)).toEqual([
      "account",
      "profile",
      "preferences",
      "entitlements",
    ]);
    expect(bundle.manifest.included.find((item) => item.category === "profile")?.fields).toEqual([
      "/profile/bio",
      "/profile/links",
      "/profile/custom~1key",
    ]);
    expect(bundle.manifest.omitted).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: "learning_records", reason: "outside_export_scope" }),
        expect.objectContaining({ category: "billing_records", reason: "outside_export_scope" }),
      ]),
    );
    expect(bundle).toHaveProperty("entitlements", []);
  });

  it("marks failed entitlements unavailable instead of exporting a fabricated empty list", async () => {
    const bundle = await loadProfileExport("member-1", async (url) => {
      if (url === "/api/v1/entitlements") throw new Error("Unavailable");
      return { data: data[url as keyof typeof data] };
    });
    expect(bundle).not.toHaveProperty("entitlements");
    expect(bundle.manifest.included.map((item) => item.category)).not.toContain("entitlements");
    expect(bundle.manifest.omitted).toContainEqual({
      category: "entitlements",
      reason: "fetch_failed",
    });
  });

  it("does not produce an export if a required profile request fails", async () => {
    await expect(
      loadProfileExport("member-1", async () => {
        throw new Error("Profile unavailable");
      }),
    ).rejects.toThrow("Profile unavailable");
  });

  it("labels successful processing as access removal with retained records", () => {
    const request = {
      status: "SUCCEEDED",
      outcome: {
        accessRemoved: true,
        erasure: "not_performed",
        retentionReviewRequired: true,
      },
    } as DeletionRequestItem;
    expect(deletionOutcomeLabel(request)).toBe("Access removed · records retained");
    expect(deletionOutcomeLabel({ ...request, outcome: null })).toBe(
      "Processed · erasure not verified",
    );
    expect(deletionOutcomeLabel({ ...request, status: "UNRECOGNIZED", outcome: null })).toBe(
      "Unknown · review required",
    );
  });

  it("renders accurate learner action, pending status, and partial download copy", () => {
    const card = renderToStaticMarkup(
      createElement(AccountDeletionCard, {
        canRequestDeletion: true,
        initialPending: true,
        email: "learner@example.test",
      }),
    );
    expect(card).toContain(
      "school-access removal request is pending review. No data has been erased.",
    );
    expect(card).toContain("retained");
    expect(card).not.toContain("Delete account");
    const privacy = renderToStaticMarkup(
      createElement(PrivacyDataForm, {
        membershipId: "member-1",
        initialVisibility: "PRIVATE",
        initialPrivacy: {
          analyticsConsent: false,
          marketingConsent: false,
          showLearningActivity: false,
        },
      }),
    );
    expect(privacy).toContain("Download profile snapshot");
    expect(privacy).toContain("partial snapshot");
    expect(privacy).toContain("separate erasure review");
    expect(privacy).not.toContain("anonymized usage analytics");
  });

  it("renders admin scope limits and access-removal consequences before any action", () => {
    const removals = renderToStaticMarkup(
      createElement(DeletionRequestsAdmin, {
        initialRequests: [],
        canManage: true,
        canFileForOthers: true,
      }),
    );
    expect(removals).toContain("School-access removal requests");
    expect(removals).toContain("Records remain retained");
    expect(removals).toContain("separate erasure and");
    expect(removals).not.toContain("permanently removes");
    const exports = renderToStaticMarkup(
      createElement(ExportsAdmin, {
        initialJobs: [],
        canRunExport: true,
      }),
    );
    expect(exports).toContain("partial school snapshot");
    expect(exports).toContain("not a complete personal-data export");
    expect(exports).toContain("Assessment submissions, billing records, files");
  });
});
