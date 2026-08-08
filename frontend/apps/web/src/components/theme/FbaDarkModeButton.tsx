"use client";

type FbaDarkModeButtonProps = {
  darkMode: boolean;
  onToggle: () => void;
  className?: string;
};

export function FbaDarkModeButton({ darkMode, onToggle, className }: FbaDarkModeButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
      className={`flex h-[38px] w-[38px] shrink-0 cursor-pointer items-center justify-center rounded-lg border-[1.5px] border-[var(--fba-bdr2)] bg-[var(--fba-surf)] text-[var(--fba-tx2)] transition-colors hover:border-[var(--fba-tx3)] hover:bg-[var(--fba-bg2)] hover:text-[var(--fba-tx)] ${className ?? ""}`}
    >
      {darkMode ? (
        <SunIcon className="h-[18px] w-[18px]" />
      ) : (
        <MoonIcon className="h-[18px] w-[18px]" />
      )}
    </button>
  );
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
