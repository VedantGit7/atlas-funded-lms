export const routeMetadata = {
  public: true,
  permission: "pub",
  rateLimit: "publicInvitationAccept",
  idempotency: "none",
  audit: "required",
} as const;
