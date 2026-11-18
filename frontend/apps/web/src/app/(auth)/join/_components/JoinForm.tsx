"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { joinAction, type JoinActionState } from "../_actions/join-action";
import { TermsAgreement } from "../../_components/TermsAgreement";

const initialState: JoinActionState = { ok: false, message: "", requestId: "" };

const primaryButtonClass =
  "w-full rounded-[10px] bg-[var(--fba-ind)] px-4 py-4 text-[15px] font-bold text-white transition-colors hover:bg-[var(--fba-ind-d)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60";

const inlineLinkClass =
  "text-[13px] font-semibold text-[var(--fba-ind-tx)] transition-colors hover:underline";

/**
 * The join step (launch plan 5.7): someone signed in who hasn't agreed to this
 * academy's Terms and Privacy Policy ticks the box here before anything is
 * opened for them.
 */
export function JoinForm({ next }: { next: string | null }) {
  const [state, formAction, pending] = useActionState(joinAction, initialState);
  const [agreed, setAgreed] = useState(false);

  // Server actions set no navigation of their own here: a full navigation keeps
  // the academy's host context for the next page (same as LoginForm).
  useEffect(() => {
    if (state.ok && state.destination) window.location.assign(state.destination);
  }, [state.ok, state.destination]);

  const signInHref = `/login?next=${encodeURIComponent(next ? `/join?next=${next}` : "/join")}`;

  return (
    <div>
      <div className="mb-8">
        <h2
          id="join-title"
          className="mb-2 text-[32px] font-extrabold leading-[1.2] tracking-[-0.01em] text-[var(--fba-tx)]"
        >
          One more step
        </h2>
        <p className="text-[15px] leading-[1.6] text-[var(--fba-tx2)]">
          Before you start, please confirm you are 18 or older and agree to the academy&apos;s Terms
          and Conditions and Privacy Policy.
        </p>
      </div>

      <form action={formAction} aria-labelledby="join-title" className="space-y-5">
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <TermsAgreement checked={agreed} onCheckedChange={setAgreed} />

        {state.message ? (
          <p role="alert" className="text-[13px] text-[var(--fba-red-tx)]">
            {state.message}{" "}
            {state.signInRequired ? (
              <Link href={signInHref} className={inlineLinkClass}>
                Sign in
              </Link>
            ) : null}
          </p>
        ) : null}

        <button type="submit" disabled={pending || !agreed} className={primaryButtonClass}>
          {pending ? "Joining..." : "Agree and continue"}
        </button>
      </form>
    </div>
  );
}
