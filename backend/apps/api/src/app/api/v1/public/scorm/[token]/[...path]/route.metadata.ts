// Credential-free for the browser, never anonymous: the path carries a signed
// package-read capability, re-authorized against the database on every request.
export const routeMetadata = {
  public: true,
  permission: "pub",
  audit: "none",
  rateLimit: "scormContent",
  idempotency: "none",
} as const;
