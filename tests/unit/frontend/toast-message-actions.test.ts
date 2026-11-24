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
  "added",
  "invited",
];

const methods: MutationHttpMethod[] = ["POST", "PUT", "PATCH", "DELETE"];

describe("mutation notification wording", () => {
  it.each(actions)("formats the %s action without changing the message", (action) => {
    expect(formatToastSuccessMessage("Record", action)).toBe(`Record ${action} successfully`);
  });

  it("keeps the written messages for known actions", () => {
    expect(resolveMutationSuccessToast("assessment-publish", "POST")).toBe(
      "Assessment submitted successfully",
    );
    expect(resolveMutationSuccessToast("course-branding-save", "PATCH")).toBe(
      "Branding saved successfully",
    );
    expect(resolveMutationSuccessToast("domain-set-primary", "POST")).toBe(
      "Primary domain set successfully",
    );
    expect(resolveMutationSuccessToast("lesson-progress-save", "PATCH", "  Done  ")).toBe("Done");
  });

  it("names course building blocks the way authors see them", () => {
    expect(resolveMutationSuccessToast("module-create", "POST")).toBe(
      "Section created successfully",
    );
    expect(resolveMutationSuccessToast("create-item", "POST")).toBe(
      "Question created successfully",
    );
    expect(resolveMutationSuccessToast("create-item-collection", "POST")).toBe(
      "Collection created successfully",
    );
  });

  // QA review 1 M16, review 2 H1: messages were made up from internal key names.
  it("says nothing for background requests and unknown keys", () => {
    for (const method of methods) {
      expect(resolveMutationSuccessToast("device-session-capture", method)).toBeNull();
      expect(resolveMutationSuccessToast("checkout-quote", method)).toBeNull();
      expect(
        resolveMutationSuccessToast("coupon-validate-0a1b2c3d-1111-4111-8111-123456789abc", method),
      ).toBeNull();
      expect(resolveMutationSuccessToast("record-constructor", method)).toBeNull();
      expect(resolveMutationSuccessToast("publish", method)).toBeNull();
    }
    expect(resolveMutationSuccessToast("lesson-progress-save", "PATCH")).toBeNull();
  });

  it("uses written confirmations for actions whose screens show none", () => {
    expect(resolveMutationSuccessToast("member-role-assign", "POST")).toBe("Role assigned");
    expect(resolveMutationSuccessToast("permission-override-delete", "DELETE")).toBe(
      "Permission override removed",
    );
    expect(resolveMutationSuccessToast("badge-revoke-abc123", "POST")).toBe("Badge revoked");
    // The longest matching prefix wins.
    expect(resolveMutationSuccessToast("batch-delete-abc123", "DELETE")).toBe("Batch deleted");
    expect(resolveMutationSuccessToast("batch-abc123", "POST")).toBe("Batch created");
    expect(resolveMutationSuccessToast("course-ios-pricing-update", "PUT")).toBe("Pricing saved");
    expect(resolveMutationSuccessToast("progress-export-create", "POST")).toBe("Export started");
    expect(resolveMutationSuccessToast("cancel-enrollment-abc123", "DELETE")).toBe(
      "Enrollment cancelled",
    );
  });

  it("no longer gets the verb wrong", () => {
    // Deleting a campaign used to say "Email Campaign created successfully".
    expect(resolveMutationSuccessToast("email-campaign-delete-abc123", "POST")).toBeNull();
  });
});
