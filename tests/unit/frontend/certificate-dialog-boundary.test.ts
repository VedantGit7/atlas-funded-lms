import { expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ dialogLoads: 0 }));
vi.mock(
  "../../../frontend/apps/web/src/features/certificates/components/CertificateShareDialog",
  () => {
    state.dialogLoads += 1;
    return { CertificateShareDialog: "share-dialog" };
  },
);
it("does not load a closed certificate-sharing dialog with the initial certificate list", async () => {
  await import("../../../frontend/apps/web/src/features/certificates/components/LearnerCertificatesClient");
  expect(state.dialogLoads).toBe(0);
});
