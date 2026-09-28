/** Error boundaries keep their UI synchronous; load reporting only for an error. */
export async function reportClientError(error: Error): Promise<void> {
  try {
    const { captureException } = await import("@sentry/nextjs");
    captureException(error);
  } catch {
    // Reporting must never crash the recovery screen or reject an unobserved
    // promise. Retain a local diagnostic when the network/SDK is unavailable.
    console.error("Unable to send the error report.", error);
  }
}
