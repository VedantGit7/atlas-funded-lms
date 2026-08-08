"use client";

function CourseInstructorEmptyIllustration() {
  return (
    <svg
      viewBox="0 0 280 180"
      className="mx-auto h-44 w-full max-w-[17.5rem] text-[var(--admin-on-surface-variant)]"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="instructor-board-fill" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--admin-primary)" stopOpacity="0.12" />
          <stop offset="100%" stopColor="var(--admin-primary)" stopOpacity="0.04" />
        </linearGradient>
      </defs>

      <rect
        x="148"
        y="34"
        width="96"
        height="72"
        rx="6"
        fill="url(#instructor-board-fill)"
        stroke="var(--admin-primary)"
        strokeWidth="1.5"
        strokeOpacity="0.35"
      />
      <rect
        x="156"
        y="44"
        width="36"
        height="28"
        rx="3"
        fill="var(--admin-surface)"
        stroke="currentColor"
        strokeWidth="1"
        strokeOpacity="0.25"
      />
      <path
        d="M162 64 L168 52 L174 58 L182 46"
        fill="none"
        stroke="var(--admin-primary)"
        strokeWidth="1.5"
        strokeOpacity="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="198"
        y="44"
        width="36"
        height="28"
        rx="3"
        fill="var(--admin-surface)"
        stroke="currentColor"
        strokeWidth="1"
        strokeOpacity="0.25"
      />
      <rect x="204" y="58" width="6" height="10" fill="var(--admin-primary)" fillOpacity="0.35" />
      <rect x="214" y="52" width="6" height="16" fill="var(--admin-primary)" fillOpacity="0.5" />
      <rect x="224" y="48" width="6" height="20" fill="var(--admin-primary-strong)" fillOpacity="0.45" />
      <line
        x1="148"
        y1="106"
        x2="244"
        y2="106"
        stroke="currentColor"
        strokeWidth="1"
        strokeOpacity="0.2"
      />

      <ellipse cx="92" cy="156" rx="38" ry="7" fill="currentColor" opacity="0.1" />
      <path
        d="M68 156 L68 112 C68 98 78 88 92 88 C106 88 116 98 116 110 L116 156"
        fill="currentColor"
        opacity="0.75"
      />
      <circle cx="92" cy="74" r="18" fill="currentColor" opacity="0.75" />
      <path
        d="M92 62 C96 58 102 58 106 62"
        fill="none"
        stroke="var(--admin-surface)"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.6"
      />
      <rect x="112" y="118" width="14" height="22" rx="3" fill="currentColor" opacity="0.55" />
      <rect x="58" y="118" width="14" height="22" rx="3" fill="currentColor" opacity="0.55" />
      <path
        d="M116 104 L148 88"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.45"
      />
      <circle cx="148" cy="88" r="4" fill="currentColor" opacity="0.45" />
    </svg>
  );
}

export function CourseInstructorEmptyIllustrationGraphic() {
  return <CourseInstructorEmptyIllustration />;
}
