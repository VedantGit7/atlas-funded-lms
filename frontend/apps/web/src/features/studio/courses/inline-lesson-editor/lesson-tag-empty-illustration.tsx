"use client";

function LessonTagEmptyIllustration() {
  return (
    <svg
      viewBox="0 0 240 160"
      className="mx-auto h-40 w-full max-w-[15rem] text-[var(--admin-on-surface-variant)]"
      aria-hidden="true"
    >
      <circle
        cx="176"
        cy="42"
        r="22"
        fill="none"
        stroke="currentColor"
        strokeDasharray="4 4"
        strokeWidth="1.5"
        opacity="0.45"
      />
      <text x="176" y="47" textAnchor="middle" fill="currentColor" fontSize="14" fontWeight="600">
        A
      </text>
      <circle
        cx="198"
        cy="88"
        r="22"
        fill="none"
        stroke="currentColor"
        strokeDasharray="4 4"
        strokeWidth="1.5"
        opacity="0.45"
      />
      <text x="198" y="93" textAnchor="middle" fill="currentColor" fontSize="14" fontWeight="600">
        B
      </text>
      <circle
        cx="160"
        cy="118"
        r="22"
        fill="none"
        stroke="currentColor"
        strokeDasharray="4 4"
        strokeWidth="1.5"
        opacity="0.45"
      />
      <text x="160" y="123" textAnchor="middle" fill="currentColor" fontSize="14" fontWeight="600">
        C
      </text>
      <ellipse cx="78" cy="132" rx="34" ry="6" fill="currentColor" opacity="0.12" />
      <path
        d="M58 132 L58 88 C58 72 68 62 82 62 C96 62 106 72 106 86 L106 132"
        fill="currentColor"
        opacity="0.85"
      />
      <circle cx="82" cy="48" r="16" fill="currentColor" opacity="0.85" />
      <path d="M106 98 L124 88 L124 108 Z" fill="currentColor" opacity="0.55" />
      <path d="M48 98 L66 88 L66 108 Z" fill="currentColor" opacity="0.55" />
    </svg>
  );
}

export function LessonTagEmptyIllustrationGraphic() {
  return <LessonTagEmptyIllustration />;
}
