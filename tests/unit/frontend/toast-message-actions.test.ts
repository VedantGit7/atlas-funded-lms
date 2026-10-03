import { describe, expect, it } from "vitest";
import {
  formatToastSuccessMessage,
  resolveMutationSuccessToast,
  type MutationHttpMethod,
  type ToastAction,
} from "../../../frontend/apps/web/src/lib/feedback/toast-messages";

const actions: ToastAction[] = [
  "updated",
  "created",
  "deleted",
  "saved",
  "published",
  "archived",
  "removed",
  "enrolled",
  "submitted",
  "issued",
  "revoked",
  "restored",
  "joined",
  "sent",
  "suspended",
  "linked",
  "attached",
  "moved",
  "set",
  "invited",
];

describe("mutation notification wording", () => {
  it.each(actions)("formats the %s action without changing the message", (action) => {
    expect(formatToastSuccessMessage("Record", action)).toBe(`Record ${action} successfully`);
  });

  it.each<[string, string]>([
    ["publish", "published"],
    ["archive", "archived"],
    ["delete", "deleted"],
    ["create", "created"],
    ["save", "saved"],
    ["restore", "restored"],
    ["submit", "submitted"],
    ["enroll", "enrolled"],
    ["issue", "issued"],
    ["revoke", "revoked"],
    ["join", "joined"],
    ["suspend", "suspended"],
    ["remove", "removed"],
    ["attach", "attached"],
    ["link", "attached"],
    ["move", "moved"],
  ])("preserves the %s suffix for every mutation method", (suffix, action) => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"] as MutationHttpMethod[]) {
      expect(resolveMutationSuccessToast(`record-${suffix}`, method)).toBe(
        `Record ${action} successfully`,
      );
    }
  });

  it.each([
    "update",
    "confirm",
    "start",
    "verify",
    "set",
    "resend",
    "invite",
    "unenroll",
    "freeze",
    "reindex",
  ])("retains HTTP-method inference for %s", (suffix) => {
    expect(resolveMutationSuccessToast(`record-${suffix}`, "POST")).toBe(
      "Record created successfully",
    );
    expect(resolveMutationSuccessToast(`record-${suffix}`, "DELETE")).toBe(
      "Record deleted successfully",
    );
    expect(resolveMutationSuccessToast(`record-${suffix}`, "PATCH")).toBe(
      "Record updated successfully",
    );
  });

  it("retains exact overrides, silent mutations, explicit messages and unknown suffixes", () => {
    expect(resolveMutationSuccessToast("assessment-publish", "POST")).toBe(
      "Assessment submitted successfully",
    );
    expect(resolveMutationSuccessToast("course-branding-save", "PATCH")).toBe(
      "Branding saved successfully",
    );
    expect(resolveMutationSuccessToast("domain-set-primary", "POST")).toBe(
      "Primary domain set successfully",
    );
    expect(resolveMutationSuccessToast("record-set-primary", "POST")).toBe(
      "Record Set Primary set successfully",
    );
    expect(resolveMutationSuccessToast("record-update-save", "POST")).toBe(
      "Record saved successfully",
    );
    expect(resolveMutationSuccessToast("publish", "POST")).toBe("Changes created successfully");
    expect(resolveMutationSuccessToast("record-constructor", "POST")).toBe(
      "Record Constructor created successfully",
    );
    expect(resolveMutationSuccessToast("lesson-progress-save", "PATCH")).toBeNull();
    expect(resolveMutationSuccessToast("lesson-progress-save", "PATCH", "  Done  ")).toBe("Done");
  });
});
