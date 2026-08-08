import type { ReactNode } from "react";

/**
 * Themed "mini mockup" previews for the features showcase. Each motif is a
 * small abstract UI illustration drawn entirely from admin design tokens and
 * the per-card `--accent` custom property, so every preview stays on-brand and
 * renders identically in light and dark mode with no external assets.
 */
export type FeatureMotif =
  | "list"
  | "player"
  | "quiz"
  | "path"
  | "chart"
  | "grid"
  | "chat"
  | "certificate"
  | "trophy"
  | "ring"
  | "people"
  | "shield"
  | "globe"
  | "receipt"
  | "bell"
  | "envelope"
  | "palette"
  | "search"
  | "card"
  | "download";

const SURFACE = "var(--admin-surface)";
const BORDER = "var(--admin-border)";
const MUTED = "var(--admin-surface-high)";
const ACCENT = "var(--accent)";
const ACCENT_SOFT = "color-mix(in srgb, var(--accent) 24%, var(--admin-surface))";

/** Floating device/card frame every motif is composed inside. */
function Frame({ children }: { children: ReactNode }) {
  return (
    <>
      <rect
        x={20}
        y={16}
        width={200}
        height={100}
        rx={12}
        fill={SURFACE}
        stroke={BORDER}
        strokeWidth={1.5}
      />
      {children}
    </>
  );
}

function bars(x: number, y: number, widths: number[], gap = 12) {
  return widths.map((w, i) => (
    <rect key={i} x={x} y={y + i * gap} width={w} height={6} rx={3} fill={MUTED} />
  ));
}

const MOTIFS: Record<FeatureMotif, ReactNode> = {
  list: (
    <Frame>
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(0 ${String(i * 26)})`}>
          <circle cx={42} cy={42} r={7} fill={i === 0 ? ACCENT : ACCENT_SOFT} />
          <rect x={58} y={35} width={92} height={6} rx={3} fill={MUTED} />
          <rect x={58} y={45} width={54} height={5} rx={2.5} fill={MUTED} />
        </g>
      ))}
    </Frame>
  ),
  player: (
    <Frame>
      <rect x={34} y={30} width={172} height={54} rx={8} fill={ACCENT_SOFT} />
      <circle cx={120} cy={57} r={15} fill={SURFACE} />
      <path d="M115 50 L131 57 L115 64 Z" fill={ACCENT} />
      <rect x={34} y={94} width={140} height={6} rx={3} fill={MUTED} />
      <rect x={34} y={94} width={70} height={6} rx={3} fill={ACCENT} />
    </Frame>
  ),
  quiz: (
    <Frame>
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(0 ${String(i * 24)})`}>
          <rect
            x={40}
            y={34}
            width={14}
            height={14}
            rx={4}
            fill={i === 1 ? ACCENT : SURFACE}
            stroke={i === 1 ? ACCENT : BORDER}
            strokeWidth={1.5}
          />
          {i === 1 ? (
            <path
              d="M43.5 41 L46 43.5 L51 38"
              fill="none"
              stroke="var(--admin-on-primary)"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
          <rect x={64} y={38} width={110} height={6} rx={3} fill={MUTED} />
        </g>
      ))}
    </Frame>
  ),
  path: (
    <Frame>
      <path
        d="M46 88 L92 88 Q104 88 104 74 L104 58 Q104 44 116 44 L174 44"
        fill="none"
        stroke={ACCENT}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeDasharray="1 7"
      />
      {([
        [46, 88],
        [104, 66],
        [174, 44],
      ] as const).map(([cx, cy], i) => (
        <g key={i}>
          <circle cx={cx} cy={cy} r={9} fill={SURFACE} stroke={ACCENT} strokeWidth={2.5} />
          <circle cx={cx} cy={cy} r={3.5} fill={ACCENT} />
        </g>
      ))}
    </Frame>
  ),
  chart: (
    <Frame>
      {([
        [50, 40],
        [78, 58],
        [106, 30],
        [134, 48],
        [162, 22],
      ] as const).map(([x, h], i) => (
        <rect
          key={i}
          x={x}
          y={96 - h}
          width={16}
          height={h}
          rx={4}
          fill={i === 4 ? ACCENT : ACCENT_SOFT}
        />
      ))}
      <line x1={40} y1={96} x2={200} y2={96} stroke={BORDER} strokeWidth={1.5} />
    </Frame>
  ),
  grid: (
    <Frame>
      {[0, 1, 2].map((col) =>
        [0, 1].map((row) => (
          <rect
            key={`${String(col)}-${String(row)}`}
            x={40 + col * 56}
            y={34 + row * 34}
            width={44}
            height={24}
            rx={6}
            fill={col === 0 && row === 0 ? ACCENT : ACCENT_SOFT}
          />
        )),
      )}
    </Frame>
  ),
  chat: (
    <Frame>
      <rect x={38} y={34} width={104} height={30} rx={10} fill={ACCENT_SOFT} />
      <rect x={48} y={44} width={70} height={5} rx={2.5} fill={MUTED} />
      <rect x={48} y={53} width={44} height={5} rx={2.5} fill={MUTED} />
      <rect x={98} y={70} width={104} height={26} rx={10} fill={ACCENT} />
      <rect x={110} y={80} width={66} height={5} rx={2.5} fill="var(--admin-on-primary)" opacity={0.8} />
    </Frame>
  ),
  certificate: (
    <Frame>
      <rect x={50} y={30} width={140} height={62} rx={6} fill={SURFACE} stroke={BORDER} strokeWidth={1.5} />
      <rect x={62} y={40} width={80} height={6} rx={3} fill={MUTED} />
      <rect x={62} y={52} width={116} height={5} rx={2.5} fill={MUTED} />
      <rect x={62} y={62} width={96} height={5} rx={2.5} fill={MUTED} />
      <circle cx={160} cy={82} r={16} fill={ACCENT_SOFT} stroke={ACCENT} strokeWidth={2} />
      <path
        d="M153 82 L158 87 L167 77"
        fill="none"
        stroke={ACCENT}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Frame>
  ),
  trophy: (
    <Frame>
      {([
        [72, 30, 2],
        [110, 20, 1],
        [148, 40, 3],
      ] as const).map(([x, h, rank]) => (
        <g key={rank}>
          <rect x={x} y={96 - h} width={30} height={h} rx={4} fill={rank === 1 ? ACCENT : ACCENT_SOFT} />
        </g>
      ))}
      <path
        d="M112 24 h16 v6 a8 8 0 0 1 -16 0 Z M108 26 a5 5 0 0 0 4 5 M132 26 a5 5 0 0 1 -4 5"
        fill={ACCENT}
        stroke={ACCENT}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </Frame>
  ),
  ring: (
    <Frame>
      <circle cx={120} cy={66} r={30} fill="none" stroke={MUTED} strokeWidth={9} />
      <circle
        cx={120}
        cy={66}
        r={30}
        fill="none"
        stroke={ACCENT}
        strokeWidth={9}
        strokeLinecap="round"
        strokeDasharray={`${String(2 * Math.PI * 30 * 0.68)} ${String(2 * Math.PI * 30)}`}
        transform="rotate(-90 120 66)"
      />
      <circle cx={120} cy={66} r={16} fill={ACCENT_SOFT} />
    </Frame>
  ),
  people: (
    <Frame>
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(0 ${String(i * 24)})`}>
          <circle cx={46} cy={40} r={9} fill={i === 0 ? ACCENT : ACCENT_SOFT} />
          <rect x={64} y={35} width={70} height={6} rx={3} fill={MUTED} />
          <rect x={162} y={35} width={26} height={11} rx={5.5} fill={ACCENT_SOFT} />
        </g>
      ))}
    </Frame>
  ),
  shield: (
    <Frame>
      <path
        d="M120 30 L150 42 V64 C150 82 137 90 120 96 C103 90 90 82 90 64 V42 Z"
        fill={ACCENT_SOFT}
        stroke={ACCENT}
        strokeWidth={2}
      />
      <path
        d="M110 62 L118 70 L133 54"
        fill="none"
        stroke={ACCENT}
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Frame>
  ),
  globe: (
    <Frame>
      <circle cx={120} cy={66} r={30} fill={ACCENT_SOFT} stroke={ACCENT} strokeWidth={2} />
      <ellipse cx={120} cy={66} rx={12} ry={30} fill="none" stroke={ACCENT} strokeWidth={1.5} />
      <line x1={90} y1={66} x2={150} y2={66} stroke={ACCENT} strokeWidth={1.5} />
      <path d="M96 50 Q120 60 144 50 M96 82 Q120 72 144 82" fill="none" stroke={ACCENT} strokeWidth={1.5} />
    </Frame>
  ),
  receipt: (
    <Frame>
      <path
        d="M76 28 h88 v76 l-11 -7 l-11 7 l-11 -7 l-11 7 l-11 -7 l-11 7 l-11 -7 Z"
        fill={SURFACE}
        stroke={BORDER}
        strokeWidth={1.5}
      />
      <rect x={88} y={40} width={64} height={6} rx={3} fill={MUTED} />
      <rect x={88} y={54} width={40} height={5} rx={2.5} fill={MUTED} />
      <rect x={132} y={54} width={20} height={5} rx={2.5} fill={ACCENT} />
      <rect x={88} y={66} width={40} height={5} rx={2.5} fill={MUTED} />
      <rect x={132} y={66} width={20} height={5} rx={2.5} fill={ACCENT} />
    </Frame>
  ),
  bell: (
    <Frame>
      <path
        d="M120 34 a18 18 0 0 1 18 18 v14 l6 8 h-48 l6 -8 v-14 a18 18 0 0 1 18 -18 Z"
        fill={ACCENT_SOFT}
        stroke={ACCENT}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <path d="M112 82 a8 8 0 0 0 16 0" fill="none" stroke={ACCENT} strokeWidth={2} strokeLinecap="round" />
      <circle cx={140} cy={40} r={8} fill={ACCENT} />
    </Frame>
  ),
  envelope: (
    <Frame>
      <rect x={62} y={38} width={116} height={58} rx={8} fill={ACCENT_SOFT} stroke={ACCENT} strokeWidth={2} />
      <path
        d="M62 46 L120 78 L178 46"
        fill="none"
        stroke={ACCENT}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Frame>
  ),
  palette: (
    <Frame>
      <circle cx={120} cy={66} r={32} fill={ACCENT_SOFT} stroke={ACCENT} strokeWidth={2} />
      <circle cx={106} cy={52} r={6} fill={ACCENT} />
      <circle cx={132} cy={50} r={6} fill="var(--admin-lesson-audio)" />
      <circle cx={142} cy={70} r={6} fill="var(--admin-lesson-video)" />
      <circle cx={120} cy={66} r={9} fill={SURFACE} stroke={BORDER} strokeWidth={1.5} />
    </Frame>
  ),
  search: (
    <Frame>
      <rect x={40} y={40} width={160} height={20} rx={10} fill={SURFACE} stroke={BORDER} strokeWidth={1.5} />
      <circle cx={56} cy={50} r={5} fill="none" stroke={ACCENT} strokeWidth={2} />
      <line x1={60} y1={54} x2={64} y2={58} stroke={ACCENT} strokeWidth={2} strokeLinecap="round" />
      <rect x={72} y={47} width={70} height={6} rx={3} fill={MUTED} />
      {bars(40, 74, [120, 90])}
    </Frame>
  ),
  card: (
    <Frame>
      <rect x={54} y={40} width={132} height={52} rx={8} fill={ACCENT} />
      <rect x={54} y={52} width={132} height={10} fill="var(--admin-on-primary)" opacity={0.18} />
      <rect x={64} y={74} width={40} height={6} rx={3} fill="var(--admin-on-primary)" opacity={0.7} />
      <circle cx={168} cy={78} r={7} fill="var(--admin-on-primary)" opacity={0.85} />
      <circle cx={158} cy={78} r={7} fill="var(--admin-on-primary)" opacity={0.5} />
    </Frame>
  ),
  download: (
    <Frame>
      <path
        d="M92 56 a20 16 0 0 1 38 -6 a15 15 0 0 1 2 30 h-44 a14 14 0 0 1 4 -24 Z"
        fill={ACCENT_SOFT}
        stroke={ACCENT}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <line x1={120} y1={60} x2={120} y2={88} stroke={ACCENT} strokeWidth={2.4} strokeLinecap="round" />
      <path
        d="M111 80 L120 89 L129 80"
        fill="none"
        stroke={ACCENT}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Frame>
  ),
};

export function FeaturePreview({ motif }: { motif: FeatureMotif }) {
  return (
    <svg
      viewBox="0 0 240 132"
      role="presentation"
      aria-hidden="true"
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      {MOTIFS[motif]}
    </svg>
  );
}
