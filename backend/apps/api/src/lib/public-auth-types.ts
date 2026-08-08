export type PublicAuthApiResponse = {
  data: {
    status:
      | "AUTHENTICATED"
      | "EMAIL_VERIFICATION_REQUIRED"
      | "MFA_REQUIRED"
      | "NO_ACTIVE_MEMBERSHIP"
      | "INVITED_MEMBERSHIP";
    redirectTo: string | null;
  };
};
