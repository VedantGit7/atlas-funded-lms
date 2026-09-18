"use client";

import { useRef } from "react";

type OtpInputProps = {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
  ariaLabel?: string;
};

/**
 * Segmented one-time-code entry. Renders `length` single-character boxes but
 * surfaces a single concatenated string via `onChange`, so the consuming form
 * can keep submitting one `code` value to the backend.
 */
export function OtpInput({
  value,
  onChange,
  length = 6,
  disabled = false,
  invalid = false,
  autoFocus = false,
  ariaLabel = "Verification code",
}: OtpInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length }, (_, index) => value[index] ?? "");

  const commit = (nextDigits: string[]) => {
    onChange(nextDigits.join("").slice(0, length));
  };

  const handleChange = (index: number, raw: string) => {
    const char = raw.replace(/\D/g, "").slice(-1);
    const next = digits.slice();
    next[index] = char;
    commit(next);
    if (char && index < length - 1) {
      refs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
    } else if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      refs.current[index - 1]?.focus();
    } else if (event.key === "ArrowRight" && index < length - 1) {
      event.preventDefault();
      refs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;
    commit(pasted.split(""));
    const focusIndex = Math.min(pasted.length, length - 1);
    refs.current[focusIndex]?.focus();
  };

  return (
    <div role="group" aria-label={ariaLabel} className="flex justify-between gap-2 sm:gap-3">
      {digits.map((digit, index) => (
        <input
          // Fixed-length positional inputs; index key is correct and stable here.
          key={index}
          ref={(el) => {
            refs.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={1}
          value={digit}
          disabled={disabled}
          autoFocus={autoFocus && index === 0}
          aria-invalid={invalid || undefined}
          aria-label={`Digit ${index + 1}`}
          onChange={(event) => {
            handleChange(index, event.target.value);
          }}
          onKeyDown={(event) => {
            handleKeyDown(index, event);
          }}
          onPaste={handlePaste}
          onFocus={(event) => {
            event.target.select();
          }}
          className="h-14 w-full rounded-[10px] border-[1.5px] border-[var(--fba-bdr)] bg-[var(--fba-surf)] text-center text-[22px] font-bold text-[var(--fba-tx)] outline-none transition-colors focus:border-[var(--fba-ind)] aria-[invalid=true]:border-[var(--fba-red)] disabled:opacity-60"
        />
      ))}
    </div>
  );
}
