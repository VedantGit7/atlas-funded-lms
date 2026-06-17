import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { resolveTenantFromRequest } from "@atlas/tenancy";
import { toSafeErrorEnvelope } from "@atlas/api";
import { getOrCreateRequestId } from "@atlas/core/request/request-id";
import {
  publicAuthOutputSchema,
  publicSignupInputSchema,
  setAuthCookies,
  signupWithPassword,
} from "@atlas/auth";
import { withGlobalDb } from "@atlas/db/global-db";

export async function POST(req: NextRequest) {
  const requestId = getOrCreateRequestId(req.headers);

  try {
    return await withGlobalDb(async (db) => {
      await resolveTenantFromRequest({ req, db });

      const input = publicSignupInputSchema.parse(await req.json());
      const result = await signupWithPassword({ db, input });

      const body = publicAuthOutputSchema.parse({
        data: {
          status: result.status,
          identity: result.identity,
        },
      });

      const response = NextResponse.json(body);

      if (result.session) {
        setAuthCookies({
          response,
          accessToken: result.session.accessToken,
          refreshToken: result.session.refreshToken,
          expiresInSeconds: result.session.expiresIn,
        });
      }

      return response;
    });
  } catch (error) {
    const safe = toSafeErrorEnvelope(error, requestId);
    return NextResponse.json(safe.body, { status: safe.status });
  }
}
