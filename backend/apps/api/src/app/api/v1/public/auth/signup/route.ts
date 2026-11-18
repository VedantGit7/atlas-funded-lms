import { NextResponse } from "next/server";
import { createPublicRouteHandler, resolveRequestTenant } from "@atlas/api";
import { enforceAddressRateLimit } from "@atlas/api/rate-limit";
import { publicSignupInputSchema, requestSignup } from "@atlas/auth";
import { sendAuthEmails } from "../../../../../../lib/auth-email";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import {
  PublicAuthResponseSchema,
  PublicSignupRequestSchema,
  rejectClientTenantId,
} from "@atlas/domain-identity";
import { stashReferralCodeForSignup } from "../../../../../../server/sales-referrals/sales-referrals.service";
import { routeMetadata } from "./route.metadata";

/**
 * Starts a sign-up: emails the link that finishes it, where the password is
 * chosen (security review 5.3, finding 1). Nothing is created here, and the
 * answer is the same for every address: a new one gets the link, one that
 * already has an account gets an email saying so, and a disabled one gets
 * nothing. The account and the learner membership are made by
 * /public/auth/signup/complete.
 */
export const POST = createPublicRouteHandler(routeMetadata, async ({ req, requestId }) => {
  // One pooled connection at a time, none during the sign-up itself (audit H3).
  const tenant = await resolveRequestTenant(req);

  const rawBody: unknown = await req.json();
  rejectClientTenantId(rawBody);
  const input = PublicSignupRequestSchema.parse(rawBody);
  // Per address as well as per IP (security review 5.3, finding 5).
  await enforceAddressRateLimit({ kind: "signup-link", email: input.email });

  // Validate + stash referral before anything else, so a bad code is refused
  // before an email goes out. It is applied when the membership is made.
  const referralCode = input.referralCode;
  if (referralCode) {
    await withTenantTx(
      {
        tenantId: tenant.tenantId,
        requestId,
        allowAnonymousTenantRead: true,
      },
      async (tx) => {
        await stashReferralCodeForSignup(tx, {
          emailNormalized: input.email,
          referralCode,
        });
      },
    );
  }

  const result = await requestSignup({
    input: publicSignupInputSchema.parse({
      email: input.email,
      displayName: input.displayName,
      inviteToken: input.inviteToken,
      acceptTerms: input.acceptTerms,
      referralCode: input.referralCode,
    }),
  });
  // Sent from the academy, with its link back to this host.
  await sendAuthEmails({ req, requestId, emails: result.emails });

  return NextResponse.json(
    PublicAuthResponseSchema.parse({
      data: { status: "EMAIL_VERIFICATION_REQUIRED", redirectTo: null },
    }),
  );
});
