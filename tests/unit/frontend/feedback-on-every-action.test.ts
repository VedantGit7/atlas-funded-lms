import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getToasts,
  pushToast,
  resetToastsForTests,
  SAME_ACTION_WINDOW_MS,
} from "../../../frontend/apps/web/src/lib/feedback/toast-store";
import {
  reportUnhandledRequestFailure,
  requestFailureMessage,
} from "../../../frontend/apps/web/src/lib/feedback/unhandled-failure";
import { ClientApiError } from "../../../frontend/apps/web/src/lib/api/errors";
import {
  spaceFormProblem,
  spaceSlugFromName,
} from "../../../frontend/apps/web/src/features/community/components/AdminSpacesEditor";

/** QA S2.5: one plain message per action, and a reason for every failure. */
function visible() {
  return getToasts()
    .filter((toast) => !toast.exiting)
    .map((toast) => `${toast.tone}: ${toast.message}`);
}

describe("one message per action (review 1 m11)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetToastsForTests();
  });
  afterEach(() => {
    resetToastsForTests();
    vi.useRealTimers();
  });

  it("shows a save made of several requests as one message", () => {
    pushToast("Form details saved", "success");
    pushToast("Form fields saved", "success");
    pushToast("Form appearance saved", "success");
    pushToast("Form saved.", "success");
    expect(visible()).toEqual(["success: Form saved."]);
  });

  it("doesn't stack the same message twice", () => {
    pushToast("Link copied.", "success");
    vi.advanceTimersByTime(SAME_ACTION_WINDOW_MS + 500);
    pushToast("Link copied.", "success");
    expect(visible()).toEqual(["success: Link copied."]);
  });

  it("drops a step's success when the action then fails", () => {
    pushToast("Form details saved", "success");
    pushToast("Button link: enter a full web address.", "error");
    expect(visible()).toEqual(["error: Button link: enter a full web address."]);
  });

  it("keeps separate actions apart", () => {
    pushToast("Branding saved", "success");
    vi.advanceTimersByTime(SAME_ACTION_WINDOW_MS + 500);
    pushToast("Theme saved", "success");
    expect(visible()).toEqual(["success: Branding saved", "success: Theme saved"]);
  });

  it("never shows more than three at once", () => {
    for (const name of ["A", "B", "C", "D", "E"]) {
      pushToast(`${name} failed`, "error");
    }
    expect(visible()).toEqual(["error: C failed", "error: D failed", "error: E failed"]);
  });

  it("keeps errors on screen longer than confirmations", () => {
    pushToast("Saved", "success");
    vi.advanceTimersByTime(SAME_ACTION_WINDOW_MS + 500);
    pushToast("Couldn't save", "error");
    vi.advanceTimersByTime(5000);
    expect(visible()).toEqual(["error: Couldn't save"]);
  });
});

describe("a reason for every failure (review 2 H33)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetToastsForTests();
  });
  afterEach(() => {
    resetToastsForTests();
    vi.useRealTimers();
  });

  it("passes the server's plain reason through", () => {
    const error = new ClientApiError(
      "VALIDATION_ERROR",
      400,
      "req_1",
      "Web address can use only lowercase letters, numbers and hyphens.",
    );
    expect(requestFailureMessage(error)).toBe(
      "Web address can use only lowercase letters, numbers and hyphens.",
    );
  });

  it("replaces bare or technical messages", () => {
    expect(
      requestFailureMessage(new ClientApiError("VALIDATION_ERROR", 400, "r", "Invalid request")),
    ).toBe("That didn't go through. Check the details and try again.");
    expect(
      requestFailureMessage(
        new ClientApiError("INTERNAL_ERROR", 500, "r", "Internal server error"),
      ),
    ).toBe("Something went wrong on our side, and nothing was changed. Try again in a moment.");
    expect(
      requestFailureMessage(new ClientApiError("AUTH_REQUIRED", 401, "r", "Unauthorized")),
    ).toBe("Your session has ended. Sign in again to continue.");
    expect(
      requestFailureMessage(new ClientApiError("RATE_LIMITED", 429, "r", "Too many requests")),
    ).toBe("Too many attempts in a row. Wait a minute and try again.");
  });

  it("shows a failure no screen caught", () => {
    const error = new ClientApiError("PERMISSION_DENIED", 403, "r", "You can't edit this course.");
    expect(reportUnhandledRequestFailure(error)).toBe(true);
    expect(visible()).toEqual(["error: You can't edit this course."]);
  });

  it("leaves other errors to the browser", () => {
    expect(reportUnhandledRequestFailure(new TypeError("x is undefined"))).toBe(false);
    expect(visible()).toEqual([]);
  });
});

describe("community space web address (review 2 H33)", () => {
  it("fills the web address in from the name", () => {
    expect(spaceSlugFromName("Trading Q&A")).toBe("trading-q-a");
    expect(spaceSlugFromName("  Café Talk!  ")).toBe("cafe-talk");
  });

  it("explains a bad web address before sending it", () => {
    expect(spaceFormProblem("trading-questions", "Trading questions")).toBeNull();
    expect(spaceFormProblem("Trading Q&A", "Trading")).toBe(
      "The web address can use only lowercase letters, numbers and single hyphens, like trading-questions.",
    );
    expect(spaceFormProblem("a", "Trading")).toBe("The web address needs at least 2 characters.");
    expect(spaceFormProblem("trading", " ")).toBe("Give the space a name.");
  });
});
