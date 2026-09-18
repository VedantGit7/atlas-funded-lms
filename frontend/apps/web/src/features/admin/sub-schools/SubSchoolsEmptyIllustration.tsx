"use client";

/** Theme-aware empty-state art for Sub-Schools (works in light and dark admin themes). */
export function SubSchoolsEmptyIllustration() {
  return (
    <svg
      viewBox="0 0 220 160"
      className="mx-auto h-36 w-full max-w-[13.75rem]"
      role="img"
      aria-label="Empty mailbox illustration"
    >
      <defs>
        <linearGradient id="subschool-box-fill" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="var(--admin-surface-high)" />
          <stop offset="100%" stopColor="var(--admin-surface)" />
        </linearGradient>
      </defs>

      {/* Ground shadow */}
      <ellipse cx="110" cy="148" rx="54" ry="6" fill="var(--admin-on-surface)" opacity="0.06" />

      {/* Post */}
      <rect
        x="104"
        y="96"
        width="12"
        height="48"
        rx="2"
        fill="var(--admin-on-surface)"
        opacity="0.55"
      />

      {/* Mailbox body */}
      <path
        d="M58 78 h104 a14 14 0 0 1 14 14 v18 a10 10 0 0 1 -10 10 H54 a10 10 0 0 1 -10 -10 V92 a14 14 0 0 1 14 -14 z"
        fill="url(#subschool-box-fill)"
        stroke="var(--admin-on-surface)"
        strokeWidth="2"
        strokeOpacity="0.75"
      />
      {/* Mailbox door seam */}
      <path
        d="M72 78 v42"
        fill="none"
        stroke="var(--admin-on-surface)"
        strokeWidth="1.5"
        strokeOpacity="0.35"
      />
      {/* Flag */}
      <path
        d="M162 70 h22 l-6 8 6 8 h-22 z"
        fill="var(--admin-success)"
        stroke="var(--admin-on-surface)"
        strokeWidth="1.25"
        strokeOpacity="0.35"
      />
      <rect
        x="158"
        y="68"
        width="4"
        height="28"
        rx="1"
        fill="var(--admin-on-surface)"
        opacity="0.55"
      />

      {/* Bird on top */}
      <ellipse
        cx="118"
        cy="58"
        rx="18"
        ry="12"
        fill="var(--admin-surface)"
        stroke="var(--admin-on-surface)"
        strokeWidth="1.75"
        strokeOpacity="0.8"
      />
      <circle
        cx="128"
        cy="54"
        r="7"
        fill="var(--admin-surface)"
        stroke="var(--admin-on-surface)"
        strokeWidth="1.5"
        strokeOpacity="0.8"
      />
      <circle cx="130" cy="53" r="1.4" fill="var(--admin-on-surface)" />
      <path d="M134 55 l8 2 -8 2 z" fill="var(--admin-warning)" />
      <path
        d="M108 52 q-10 -14 -2 -22"
        fill="none"
        stroke="var(--admin-on-surface)"
        strokeWidth="1.5"
        strokeOpacity="0.7"
        strokeLinecap="round"
      />
      {/* Leaf in beak area accent */}
      <path d="M96 44 q8 -10 16 -2 q-10 4 -16 2 z" fill="var(--admin-success)" opacity="0.9" />

      {/* Birds peeking from mailbox */}
      <circle
        cx="88"
        cy="102"
        r="9"
        fill="var(--admin-surface)"
        stroke="var(--admin-on-surface)"
        strokeWidth="1.5"
        strokeOpacity="0.75"
      />
      <circle cx="91" cy="100" r="1.2" fill="var(--admin-on-surface)" />
      <path d="M96 102 l5 1.5 -5 1.5 z" fill="var(--admin-warning)" />

      <circle
        cx="112"
        cy="106"
        r="8"
        fill="var(--admin-surface)"
        stroke="var(--admin-on-surface)"
        strokeWidth="1.5"
        strokeOpacity="0.75"
      />
      <circle cx="115" cy="104" r="1.1" fill="var(--admin-on-surface)" />
      <path d="M119 106 l4.5 1.2 -4.5 1.2 z" fill="var(--admin-warning)" />
    </svg>
  );
}
