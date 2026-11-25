import { pushToast } from "./toast-store";

/**
 * The words for a failed request, for a screen that shows them itself or for
 * the safety net below. The server's message already says what went wrong in
 * plain words (QA S2.5), so it is used as is; the fallbacks cover the cases
 * where there is no usable message.
 */
export function requestFailureMessage(error: unknown): string {
  const status =
    error && typeof error === "object" && "status" in error && typeof error.status === "number"
      ? error.status
      : null;
  const message = error instanceof Error ? error.message.trim() : "";

  if (status === 401) return "Your session has ended. Sign in again to continue.";
  if (status === 403 && (!message || /^(forbidden|permission denied)\.?$/i.test(message))) {
    return "You don't have permission to do that.";
  }
  if (status === 429) return "Too many attempts in a row. Wait a minute and try again.";
  if (status !== null && status >= 500) {
    return "Something went wrong on our side, and nothing was changed. Try again in a moment.";
  }
  if (!message || /^(request failed|invalid request|bad request)\.?$/i.test(message)) {
    return "That didn't go through. Check the details and try again.";
  }
  return message;
}

function isRequestFailure(reason: unknown): boolean {
  return (
    reason instanceof Error &&
    reason.name === "ClientApiError" &&
    "status" in reason &&
    typeof reason.status === "number"
  );
}

/**
 * Shows a request failure that no screen caught (a click handler that awaited
 * a save without a `catch`). Returns whether it was one, so the caller can
 * stop the browser logging it as an uncaught error.
 */
export function reportUnhandledRequestFailure(reason: unknown): boolean {
  if (!isRequestFailure(reason)) return false;
  pushToast(requestFailureMessage(reason), "error");
  return true;
}
