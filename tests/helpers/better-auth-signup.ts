import { completeSignup, requestSignup, type AuthEmail } from "@atlas/auth";

type QueryableDb = Parameters<typeof completeSignup>[0]["db"];

/** The token of the one email of this kind, or a failure naming what came instead. */
export function signupLinkToken(emails: AuthEmail[]): string {
  const link = emails.find((email) => email.kind === "complete-signup");
  if (!link)
    throw new Error(
      `expected a complete-signup email, got ${emails.map((e) => e.kind).join(", ") || "none"}`,
    );
  return link.token;
}

/**
 * Signs up the way a person does since the 5.3 security review: the form
 * names the address, the emailed link is opened, and the password is chosen
 * there. Returns the Set-Cookie headers of the session it starts.
 */
export async function signUpThroughEmailedLink(args: {
  db: QueryableDb;
  email: string;
  password: string;
  displayName?: string;
  req: () => Request;
}): Promise<{ setCookies: string[] }> {
  const started = await requestSignup({
    input: { email: args.email, displayName: args.displayName ?? "Test Learner" },
  });
  const completed = await completeSignup({
    db: args.db,
    input: { token: signupLinkToken(started.emails), password: args.password },
    req: args.req(),
  });
  if (!("setCookies" in completed.session)) throw new Error("expected Better Auth cookies");
  return { setCookies: completed.session.setCookies };
}
