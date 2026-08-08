"use server";

import { headers } from "next/headers";
import {
  AcceptInvitationRequestSchema,
  SetInvitationPasswordRequestSchema,
} from "@atlas/contracts/domain-identity/schemas/invitation-public";
import { extractAccessToken } from "@atlas/auth/session";
import { safeInvitationErrorMessage } from "../../../../../lib/auth-messages";
import { ServerPublicApiError, serverPublicApi } from "../../../../../lib/server/public-auth-fetch";
import { readFormString } from "../../../../../lib/server/form";

export type AcceptInvitationActionState = {
  ok: boolean;
  message: string;
  requestId: string;
  /** Set on success; the client performs a full navigation (see LoginForm). */
  destination?: string;
};

export async function acceptInvitationAction(
  _prev: AcceptInvitationActionState | null,
  formData: FormData,
): Promise<AcceptInvitationActionState> {
  const parsed = AcceptInvitationRequestSchema.safeParse({
    token: readFormString(formData.get("token")),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: safeInvitationErrorMessage(undefined),
      requestId: crypto.randomUUID(),
    };
  }

  const headerList = await headers();
  const req = new Request("https://placeholder.local", {
    headers: { cookie: headerList.get("cookie") ?? "" },
  });
  const accessToken = await extractAccessToken(req);

  if (!accessToken) {
    return {
      ok: false,
      message: safeInvitationErrorMessage("AUTH_REQUIRED"),
      requestId: crypto.randomUUID(),
    };
  }

  try {
    const body = await serverPublicApi.acceptInvitation(parsed.data);
    return {
      ok: true,
      message: "Invitation accepted.",
      requestId: crypto.randomUUID(),
      destination: body.data.redirectTo ?? "/",
    };
  } catch (error) {
    if (error instanceof ServerPublicApiError) {
      return {
        ok: false,
        message: safeInvitationErrorMessage(error.code),
        requestId: error.requestId,
      };
    }

    return {
      ok: false,
      message: safeInvitationErrorMessage(undefined),
      requestId: crypto.randomUUID(),
    };
  }
}

export async function setInvitationPasswordAction(
  _prev: AcceptInvitationActionState | null,
  formData: FormData,
): Promise<AcceptInvitationActionState> {
  const parsed = SetInvitationPasswordRequestSchema.safeParse({
    token: readFormString(formData.get("token")),
    password: readFormString(formData.get("password")),
    accessToken: readFormString(formData.get("accessToken")),
    refreshToken: readFormString(formData.get("refreshToken")),
  });

  if (!parsed.success) {
    const passwordIssue = parsed.error.issues.find((issue) => issue.path[0] === "password");
    return {
      ok: false,
      message: passwordIssue
        ? "Password must be at least 8 characters."
        : "This invitation link is invalid or has expired. Request a new invitation.",
      requestId: crypto.randomUUID(),
    };
  }

  try {
    const body = await serverPublicApi.setInvitationPassword(parsed.data);
    return {
      ok: true,
      message: "Password saved.",
      requestId: crypto.randomUUID(),
      destination: body.data.redirectTo ?? "/",
    };
  } catch (error) {
    if (error instanceof ServerPublicApiError) {
      return {
        ok: false,
        message: safeInvitationErrorMessage(error.code),
        requestId: error.requestId,
      };
    }

    return {
      ok: false,
      message: safeInvitationErrorMessage(undefined),
      requestId: crypto.randomUUID(),
    };
  }
}
