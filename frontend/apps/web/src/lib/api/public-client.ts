export { clientApi, ClientApiError } from "../client-api";

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

export type AcceptInvitationApiResponse = {
  data: {
    status: "ACCEPTED" | "LOGIN_REQUIRED" | "SIGNUP_REQUIRED";
    redirectTo: string | null;
  };
};

export type SetInvitationPasswordApiResponse = {
  data: {
    status: "ACCEPTED";
    redirectTo: string | null;
  };
};
