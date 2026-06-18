"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { extractAccessToken } from "@atlas/auth/session";
import { safeInvitationErrorMessage } from "@atlas/domain-identity";
import { ServerPublicApiError, serverPublicApi } from "../../../../../lib/server/public-auth-fetch";
import { readFormString } from "../../../../../lib/server/form";

export type AcceptInvitationActionState = {
  ok: boolean;
  message: string;
  requestId: string;
};

export async function acceptInvitationAction(
  _prev: AcceptInvitationActionState | null,
  formData: FormData,
): Promise<AcceptInvitationActionState> {
  const token = readFormString(formData.get("token")).trim();

  if (!token) {
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
    const body = await serverPublicApi.acceptInvitation({ token });

    if (body.data.redirectTo) {
      redirect(body.data.redirectTo);
    }

    redirect("/");
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
