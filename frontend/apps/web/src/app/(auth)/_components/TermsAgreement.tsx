"use client";

import { useId } from "react";

const linkClass =
  "font-semibold text-[var(--fba-ind-tx)] underline-offset-2 transition-colors hover:underline";

type TermsAgreementProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Shown under the box when the form was sent without it ticked. */
  error?: string | null;
  disabled?: boolean;
};

/**
 * The "I agree" box every way into an academy asks for (launch plan 5.7): no
 * account or membership is opened until it is ticked, and the server checks
 * it too. It submits `acceptTerms=true` with the form it sits in. The links
 * open in a new tab so a half-filled form isn't lost.
 */
export function TermsAgreement({
  checked,
  onCheckedChange,
  error = null,
  disabled = false,
}: TermsAgreementProps) {
  const errorId = useId();
  return (
    <div>
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          name="acceptTerms"
          value="true"
          required
          checked={checked}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => {
            onCheckedChange(event.target.checked);
          }}
          className="mt-[2px] h-[18px] w-[18px] shrink-0 rounded border-[1.5px] border-[var(--fba-bdr2)] accent-[var(--fba-ind)]"
        />
        <span className="text-[13px] leading-[1.6] text-[var(--fba-tx2)]">
          I am 18 or older, and I agree to the{" "}
          <a href="/terms" target="_blank" rel="noopener" className={linkClass}>
            Terms and Conditions
          </a>{" "}
          and{" "}
          <a href="/privacy" target="_blank" rel="noopener" className={linkClass}>
            Privacy Policy
          </a>
          .
        </span>
      </label>
      {error ? (
        <p id={errorId} role="alert" className="mt-2 text-[13px] text-[var(--fba-red-tx)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
