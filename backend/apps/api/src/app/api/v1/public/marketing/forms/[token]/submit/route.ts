import { NextResponse } from "next/server";
import { createPublicRouteHandler, resolveRequestTenant } from "@atlas/api";
import { enforceAddressRateLimit } from "@atlas/api/rate-limit";
import { publicSignupInputSchema, requestSignup } from "@atlas/auth";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { sendAuthEmails } from "../../../../../../../../lib/auth-email";
import {
  publicSubmitFormResponse,
  submitPublicMarketingForm,
} from "../../../../../../../../server/marketing-forms/marketing-forms.service";
import { routeMetadata } from "./route.metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readToken(req: Request): string {
  const segments = new URL(req.url).pathname.split("/").filter(Boolean);
  // .../public/marketing/forms/:token/submit
  const submitIdx = segments.lastIndexOf("submit");
  return decodeURIComponent(segments[submitIdx - 1] ?? "");
}

export const POST = createPublicRouteHandler(routeMetadata, async ({ req, requestId }) => {
  const token = readToken(req);
  const body: unknown = await req.json();
  const tenant = await resolveRequestTenant(req);
  const submission = await withTenantTx(
    {
      tenantId: tenant.tenantId,
      requestId,
      allowAnonymousTenantRead: true,
    },
    async (tx) =>
      submitPublicMarketingForm(tx, { tenantId: tenant.tenantId, requestId }, token, body),
  );

  // A sign-up form starts the academy's own sign-up, exactly as /signup does:
  // the person is emailed the link that finishes it, where they choose a
  // password (QA review 2 H30). The form agreed to the terms (a required
  // consent field) and gave a name.
  let signupEmailSent = false;
  if (submission.signup) {
    await enforceAddressRateLimit({ kind: "signup-link", email: submission.signup.email });
    const result = await requestSignup({
      input: publicSignupInputSchema.parse({
        email: submission.signup.email,
        displayName: submission.signup.displayName,
        acceptTerms: true,
      }),
    });
    await sendAuthEmails({ req, requestId, emails: result.emails });
    signupEmailSent = true;
  }

  return NextResponse.json(publicSubmitFormResponse(submission, signupEmailSent), {
    status: 200,
  });
});
