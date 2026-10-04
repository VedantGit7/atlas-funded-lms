"use client";

/**
 * Step-up MFA coordination (audit H4).
 *
 * Sensitive routes answer 403 MFA_REQUIRED until this session has completed
 * MFA. The API client asks here whether the user can step up; a mounted
 * dialog answers by verifying an authenticator code (or sending the user to
 * set one up), and the client retries the request once on success.
 *
 * Concurrent requests that hit the requirement share one prompt.
 */
type StepUpHandler = (reason: string) => Promise<boolean>;

let handler: StepUpHandler | null = null;
let pending: Promise<boolean> | null = null;

/** Registers the dialog that performs step-up. Returns an unregister function. */
export function registerMfaStepUpHandler(next: StepUpHandler): () => void {
  handler = next;
  return () => {
    if (handler === next) handler = null;
  };
}

/** Resolves true once the session has completed MFA; false if the user declined or none is mounted. */
export function requestMfaStepUp(reason: string): Promise<boolean> {
  if (!handler) return Promise.resolve(false);
  pending ??= handler(reason).finally(() => {
    pending = null;
  });
  return pending;
}
