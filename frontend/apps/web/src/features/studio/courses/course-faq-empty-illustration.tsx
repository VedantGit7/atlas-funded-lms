"use client";

function CourseFaqEmptyIllustration() {
  return (
    <svg
      viewBox="0 0 280 180"
      className="mx-auto h-44 w-full max-w-[17.5rem] text-[var(--admin-on-surface-variant)]"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="faq-letter-fill" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="var(--admin-primary)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--admin-primary)" stopOpacity="0.06" />
        </linearGradient>
      </defs>

      <text
        x="52"
        y="92"
        fill="url(#faq-letter-fill)"
        stroke="var(--admin-primary)"
        strokeWidth="1.5"
        strokeOpacity="0.35"
        fontSize="56"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
      >
        F
      </text>
      <text
        x="98"
        y="92"
        fill="url(#faq-letter-fill)"
        stroke="var(--admin-primary)"
        strokeWidth="1.5"
        strokeOpacity="0.35"
        fontSize="56"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
      >
        A
      </text>
      <text
        x="144"
        y="92"
        fill="url(#faq-letter-fill)"
        stroke="var(--admin-primary)"
        strokeWidth="1.5"
        strokeOpacity="0.35"
        fontSize="56"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
      >
        Q
      </text>

      <circle
        cx="214"
        cy="36"
        r="18"
        fill="var(--admin-surface)"
        stroke="var(--admin-primary)"
        strokeWidth="1.5"
        strokeOpacity="0.45"
      />
      <text
        x="214"
        y="42"
        textAnchor="middle"
        fill="var(--admin-primary-strong)"
        fontSize="18"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
      >
        ?
      </text>
      <path
        d="M198 52 Q214 58 228 48"
        fill="none"
        stroke="var(--admin-primary)"
        strokeWidth="1.5"
        strokeOpacity="0.35"
        strokeLinecap="round"
      />

      <ellipse cx="118" cy="156" rx="42" ry="7" fill="currentColor" opacity="0.1" />
      <path
        d="M92 156 L92 112 C92 96 102 86 118 86 C134 86 144 96 144 110 L144 156"
        fill="currentColor"
        opacity="0.75"
      />
      <circle cx="118" cy="72" r="18" fill="currentColor" opacity="0.75" />
      <rect x="136" y="118" width="14" height="22" rx="3" fill="currentColor" opacity="0.55" />
      <rect x="86" y="118" width="14" height="22" rx="3" fill="currentColor" opacity="0.55" />
    </svg>
  );
}

export function CourseFaqEmptyIllustrationGraphic() {
  return <CourseFaqEmptyIllustration />;
}
