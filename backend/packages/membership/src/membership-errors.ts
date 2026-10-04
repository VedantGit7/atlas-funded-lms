import { AtlasHttpError } from "@atlas/core/http/errors";
import type { MembershipStatus } from "./types";

export function noMembership(): AtlasHttpError {
  return new AtlasHttpError({
    code: "NO_MEMBERSHIP",
    status: 403,
    message: "You do not have an active membership for this tenant.",
  });
}

export function membershipPending(): AtlasHttpError {
  return new AtlasHttpError({
    code: "MEMBERSHIP_PENDING",
    status: 403,
    message: "Your invitation must be accepted before access is allowed.",
  });
}

export function membershipSuspended(): AtlasHttpError {
  return new AtlasHttpError({
    code: "MEMBERSHIP_SUSPENDED",
    status: 403,
    message: "Your membership is suspended.",
  });
}

export function membershipRemoved(): AtlasHttpError {
  return new AtlasHttpError({
    code: "MEMBERSHIP_REMOVED",
    status: 403,
    message: "Your membership is no longer active.",
  });
}

export function principalDisabled(): AtlasHttpError {
  return new AtlasHttpError({
    code: "ACCOUNT_DISABLED",
    status: 403,
    message: "This account has been disabled. Contact support if you think this is a mistake.",
  });
}

export function invalidInvitation(): AtlasHttpError {
  return new AtlasHttpError({
    code: "INVALID_INVITATION",
    status: 404,
    message: "Invitation not found or expired.",
  });
}

export function invitationEmailMismatch(): AtlasHttpError {
  return new AtlasHttpError({
    code: "INVITATION_EMAIL_MISMATCH",
    status: 403,
    message: "Sign in with the email address that received this invitation.",
  });
}

export function permissionDeniedBeforeCan(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 403,
    message: "Permission check is required before this resource can be read.",
  });
}

export function membershipStatusToError(status: MembershipStatus): AtlasHttpError {
  switch (status) {
    case "INVITED":
      return membershipPending();
    case "SUSPENDED":
      return membershipSuspended();
    case "REMOVED":
      return membershipRemoved();
    case "ACTIVE":
      throw new Error("ACTIVE membership is not an error");
  }
}
