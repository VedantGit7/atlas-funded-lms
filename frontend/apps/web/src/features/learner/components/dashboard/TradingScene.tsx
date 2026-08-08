"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  ContactShadows,
  Environment,
  Float,
  Html,
  Lightformer,
  Line,
  Sparkles,
} from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import {
  CatmullRomCurve3,
  MathUtils,
  QuadraticBezierCurve3,
  Shape,
  Vector3,
  type Group,
  type Mesh,
} from "three";

/**
 * A realistic, fast trading-terminal centerpiece. Six scenes cycle: an
 * auto-scaling candlestick chart (with grid, moving-average line and a live
 * price tag), USD/INR exchange (real FX rate), an area price chart, a cumulative
 * order-book depth chart, a world-markets globe, and an options payoff surface.
 * Colors follow the TradingView convention (#26A69A / #EF5350). Client-only.
 */

const SCENES = ["candles", "currency", "line", "depth", "globe", "payoff"] as const;
type SceneKey = (typeof SCENES)[number];
const SCENE_LABELS: Record<SceneKey, string> = {
  candles: "BTC / USDT · 1m",
  currency: "USD / INR",
  line: "Portfolio value",
  depth: "Order book",
  globe: "Global markets",
  payoff: "Options payoff",
};

const UP = "#26a69a"; // TradingView bullish teal-green
const DOWN = "#ef5350"; // TradingView bearish red
const GRID = "#1c2333";

function priceToY(p: number, min: number, max: number): number {
  const span = max - min || 1;
  return ((p - min) / span) * 3 - 1.5;
}

function useEnter(ref: React.RefObject<Group | null>) {
  const t = useRef(0);
  useFrame((_, delta) => {
    if (!ref.current || t.current >= 1) return;
    t.current = Math.min(1, t.current + delta * 2.4);
    const eased = 1 - Math.pow(1 - t.current, 3);
    ref.current.scale.setScalar(0.6 + eased * 0.4);
  });
}

/* --------------------------- Scene 1: Candlesticks ------------------------- */

type Candle = { open: number; close: number; high: number; low: number; up: boolean };

function makeCandle(prevClose: number): Candle {
  const open = prevClose;
  const close = MathUtils.clamp(open + (Math.random() - 0.49) * 0.8, 0.3, 3.6);
  const high = Math.max(open, close) + Math.random() * 0.28;
  const low = Math.min(open, close) - Math.random() * 0.28;
  return { open, close, high, low, up: close >= open };
}

function CandleBar({ c, x, min, max }: { c: Candle; x: number; min: number; max: number }) {
  const body = useRef<Mesh>(null);
  const wick = useRef<Mesh>(null);
  const oY = priceToY(c.open, min, max);
  const cY = priceToY(c.close, min, max);
  const hY = priceToY(c.high, min, max);
  const lY = priceToY(c.low, min, max);
  const bodyMid = (oY + cY) / 2;
  const bodyH = Math.max(0.03, Math.abs(cY - oY));
  const wickMid = (hY + lY) / 2;
  const wickH = Math.max(0.05, hY - lY);
  useFrame(() => {
    if (body.current) {
      body.current.scale.y = MathUtils.lerp(body.current.scale.y, bodyH, 0.25);
      body.current.position.y = MathUtils.lerp(body.current.position.y, bodyMid, 0.25);
    }
    if (wick.current) {
      wick.current.scale.y = MathUtils.lerp(wick.current.scale.y, wickH, 0.25);
      wick.current.position.y = MathUtils.lerp(wick.current.position.y, wickMid, 0.25);
    }
  });
  const color = c.up ? UP : DOWN;
  return (
    <group position={[x, 0, 0]}>
      <mesh ref={wick} position={[0, wickMid, 0]} scale={[1, wickH, 1]}>
        <boxGeometry args={[0.03, 1, 0.03]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh ref={body} position={[0, bodyMid, 0]} scale={[1, bodyH, 1]}>
        <boxGeometry args={[0.19, 1, 0.19]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.22} roughness={0.55} metalness={0.15} />
      </mesh>
    </group>
  );
}

function CandleScene({ accent }: { accent: string }) {
  const group = useRef<Group>(null);
  useEnter(group);
  const COUNT = 18;
  const [candles, setCandles] = useState<Candle[]>(() => {
    const arr: Candle[] = [];
    let prev = 1.8;
    for (let i = 0; i < COUNT; i += 1) {
      const c = makeCandle(prev);
      prev = c.close;
      arr.push(c);
    }
    return arr;
  });
  useEffect(() => {
    const t = window.setInterval(() => {
      setCandles((cur) => [...cur.slice(1), makeCandle(cur[cur.length - 1]?.close ?? 1.8)]);
    }, 700);
    return () => {
      window.clearInterval(t);
    };
  }, []);

  let min = Infinity;
  let max = -Infinity;
  for (const c of candles) {
    if (c.low < min) min = c.low;
    if (c.high > max) max = c.high;
  }
  const pad = (max - min) * 0.08 || 0.4;
  min -= pad;
  max += pad;

  const xFor = (i: number) => (i / (COUNT - 1) - 0.5) * 6;
  const ma = candles.map((_, i) => {
    const window = candles.slice(Math.max(0, i - 5), i + 1);
    const avg = window.reduce((s, c) => s + c.close, 0) / window.length;
    return [xFor(i), priceToY(avg, min, max), 0.06] as [number, number, number];
  });
  const last = candles[candles.length - 1];
  const lastPrice = last ? 1500 + last.close * 180 : 0;

  return (
    <group ref={group} rotation={[0.05, -0.1, 0]}>
      <gridHelper args={[6.6, 9, GRID, GRID]} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.35]} />
      {candles.map((c, i) => (
        <CandleBar key={i} c={c} x={xFor(i)} min={min} max={max} />
      ))}
      <Line points={ma} color={accent} lineWidth={2} transparent opacity={0.9} />
      {last ? (
        <Html position={[3.2, priceToY(last.close, min, max), 0]} distanceFactor={7} pointerEvents="none">
          <div
            style={{
              whiteSpace: "nowrap",
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
              fontSize: 15,
              color: "#fff",
              background: last.up ? UP : DOWN,
              padding: "2px 8px",
              borderRadius: 4,
            }}
          >
            {lastPrice.toFixed(2)}
          </div>
        </Html>
      ) : null}
    </group>
  );
}

/* ---------------------------- Scene 2: Currency ---------------------------- */

function Coin({ position, color, symbol }: { position: [number, number, number]; color: string; symbol: string }) {
  return (
    <group position={position}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.74, 0.74, 0.16, 64]} />
        <meshStandardMaterial color={color} metalness={1} roughness={0.22} envMapIntensity={1.3} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.74, 0.03, 12, 64]} />
        <meshStandardMaterial color={color} metalness={1} roughness={0.2} envMapIntensity={1.5} />
      </mesh>
      <Html center position={[0, 0, 0.1]} distanceFactor={7} pointerEvents="none">
        <span style={{ fontSize: 34, fontWeight: 800, color: "#12100a" }}>{symbol}</span>
      </Html>
    </group>
  );
}

function useTickingRate(base: number): { value: string; up: boolean } {
  const [rate, setRate] = useState(base);
  const prev = useRef(base);
  useEffect(() => {
    setRate(base);
    prev.current = base;
    const t = window.setInterval(() => {
      setRate((r) => {
        prev.current = r;
        return base + (Math.random() - 0.5) * 0.14;
      });
    }, 700);
    return () => {
      window.clearInterval(t);
    };
  }, [base]);
  return { value: rate.toFixed(2), up: rate >= prev.current };
}

function CurrencyScene({ accent, usdInr }: { accent: string; usdInr: number | null }) {
  const group = useRef<Group>(null);
  useEnter(group);
  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.3;
  });
  const { value, up } = useTickingRate(usdInr && usdInr > 0 ? usdInr : 83.2);
  return (
    <group ref={group}>
      <Float speed={1.6} rotationIntensity={0.4} floatIntensity={0.7}>
        <Coin position={[-1.2, 0.1, 0]} color="#f4c542" symbol="$" />
        <Coin position={[1.2, -0.1, 0]} color="#ff8a3d" symbol="₹" />
      </Float>
      <mesh rotation={[Math.PI / 2.1, 0, 0]}>
        <torusGeometry args={[2.2, 0.015, 16, 100]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.1} toneMapped={false} transparent opacity={0.6} />
      </mesh>
      <Html center position={[0, -1.95, 0]} distanceFactor={8} pointerEvents="none">
        <div style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "#eaf1ff", background: "rgba(8,12,24,0.65)", padding: "5px 14px", borderRadius: 6, fontSize: 20, border: "1px solid rgba(255,255,255,0.08)" }}>
          <span style={{ opacity: 0.7, fontSize: 13 }}>USD/INR</span>
          <span style={{ color: up ? UP : DOWN }}>₹{value}</span>
        </div>
      </Html>
    </group>
  );
}

/* --------------------------- Scene 3: Line chart --------------------------- */

function LineScene({ accent }: { accent: string }) {
  const group = useRef<Group>(null);
  const dot = useRef<Mesh>(null);
  useEnter(group);
  const { points, fill, curve, tip } = useMemo(() => {
    const raw: Array<[number, number, number]> = [];
    let y = -1.2;
    for (let i = 0; i <= 30; i += 1) {
      y += (Math.random() - 0.44) * 0.28;
      y = MathUtils.clamp(y, -1.7, 1.7);
      raw.push([(i / 30 - 0.5) * 6, y, 0]);
    }
    const t = raw[raw.length - 1] ?? [3, 1, 0];
    const shape: Array<[number, number, number]> = [
      [raw[0]?.[0] ?? -3, -1.9, -0.02],
      ...raw.map((p) => [p[0], p[1], -0.02] as [number, number, number]),
      [t[0], -1.9, -0.02],
    ];
    const cur = new CatmullRomCurve3(raw.map((p) => new Vector3(p[0], p[1], p[2])));
    return { points: raw, fill: shape, curve: cur, tip: t };
  }, []);
  useFrame(() => {
    if (dot.current) {
      const p = curve.getPointAt((Math.sin(Date.now() * 0.0006) + 1) / 2);
      dot.current.position.set(p.x, p.y, 0.05);
    }
  });
  return (
    <group ref={group} rotation={[0.04, -0.05, 0]}>
      <gridHelper args={[6.6, 9, GRID, GRID]} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.35]} />
      <mesh>
        <shapeGeometry args={[buildShape(fill)]} />
        <meshBasicMaterial color={accent} transparent opacity={0.14} />
      </mesh>
      <Line points={points} color={accent} lineWidth={3} />
      <mesh ref={dot}>
        <sphereGeometry args={[0.1, 20, 20]} />
        <meshStandardMaterial color="#ffffff" emissive={accent} emissiveIntensity={1.6} toneMapped={false} />
      </mesh>
      <Html position={[tip[0] + 0.15, tip[1], 0]} distanceFactor={7} pointerEvents="none">
        <div style={{ whiteSpace: "nowrap", fontWeight: 700, fontVariantNumeric: "tabular-nums", fontSize: 14, color: "#fff", background: accent, padding: "2px 8px", borderRadius: 4 }}>
          +{(12 + tip[1] * 6).toFixed(1)}%
        </div>
      </Html>
    </group>
  );
}

function buildShape(pts: Array<[number, number, number]>): Shape {
  const shape = new Shape();
  const first = pts[0] ?? [0, 0, 0];
  shape.moveTo(first[0], first[1]);
  for (const p of pts.slice(1)) shape.lineTo(p[0], p[1]);
  shape.closePath();
  return shape;
}

/* ------------------------------ Scene 4: Depth ----------------------------- */

function DepthScene({ accent }: { accent: string }) {
  const group = useRef<Group>(null);
  useEnter(group);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => {
      setTick((v) => v + 1);
    }, 900);
    return () => {
      window.clearInterval(t);
    };
  }, []);
  const { bid, ask, bidShape, askShape } = useMemo(() => {
    const L = 9;
    const step = 0.34;
    const base = -1.6;
    const cx = 0.18;
    const build = (dir: number) => {
      const pts: Array<[number, number, number]> = [];
      let cum = 0;
      for (let i = 0; i <= L; i += 1) {
        cum += i === 0 ? 0.2 : 0.25 + Math.random() * 0.7;
        pts.push([dir * (cx + i * step), base + cum * 0.42, 0]);
      }
      return pts;
    };
    const b = build(-1);
    const a = build(1);
    const shp = (pts: Array<[number, number, number]>): Shape => {
      const s = new Shape();
      s.moveTo(pts[0]?.[0] ?? 0, base);
      for (const p of pts) s.lineTo(p[0], p[1]);
      s.lineTo(pts[pts.length - 1]?.[0] ?? 0, base);
      s.closePath();
      return s;
    };
    return { bid: b, ask: a, bidShape: shp(b), askShape: shp(a) };
  }, [tick]);
  useFrame(() => {
    if (group.current) group.current.rotation.y = Math.sin(Date.now() * 0.0003) * 0.18;
  });
  return (
    <group ref={group} rotation={[0.05, 0, 0]}>
      <mesh position={[0, 0, -0.04]}>
        <shapeGeometry args={[bidShape]} />
        <meshBasicMaterial color={UP} transparent opacity={0.2} />
      </mesh>
      <mesh position={[0, 0, -0.04]}>
        <shapeGeometry args={[askShape]} />
        <meshBasicMaterial color={DOWN} transparent opacity={0.2} />
      </mesh>
      <Line points={bid} color={UP} lineWidth={2.5} />
      <Line points={ask} color={DOWN} lineWidth={2.5} />
      <Line points={[[0, -1.7, 0], [0, 1.6, 0]]} color={accent} lineWidth={1} dashed dashScale={4} transparent opacity={0.5} />
      <gridHelper args={[7, 8, GRID, GRID]} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.35]} />
    </group>
  );
}

/* ------------------------------ Scene 5: Globe ----------------------------- */

function GlobeScene({ accent }: { accent: string }) {
  const group = useRef<Group>(null);
  useEnter(group);
  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.25;
  });
  const R = 1.7;
  const arcs = useMemo(() => {
    const surface = (): Vector3 => {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      return new Vector3(R * Math.sin(phi) * Math.cos(theta), R * Math.cos(phi), R * Math.sin(phi) * Math.sin(theta));
    };
    return Array.from({ length: 8 }, () => {
      const a = surface();
      const b = surface();
      const mid = a.clone().add(b).multiplyScalar(0.5).normalize().multiplyScalar(R * 1.5);
      return new QuadraticBezierCurve3(a, mid, b).getPoints(30).map((v) => [v.x, v.y, v.z] as [number, number, number]);
    });
  }, []);
  const nodes = useMemo(
    () => arcs.flatMap((arc) => [arc[0], arc[arc.length - 1]]).filter(Boolean) as Array<[number, number, number]>,
    [arcs],
  );
  return (
    <group ref={group} rotation={[0.3, 0, 0.1]}>
      <mesh>
        <icosahedronGeometry args={[R, 4]} />
        <meshStandardMaterial color={accent} wireframe transparent opacity={0.28} />
      </mesh>
      <mesh>
        <sphereGeometry args={[R * 0.99, 48, 48]} />
        <meshStandardMaterial color="#0a1224" metalness={0.4} roughness={0.6} transparent opacity={0.6} />
      </mesh>
      {arcs.map((arc, i) => (
        <Line key={i} points={arc} color={i % 2 ? UP : accent} lineWidth={2} transparent opacity={0.85} />
      ))}
      {nodes.map((n, i) => (
        <mesh key={i} position={n}>
          <sphereGeometry args={[0.045, 12, 12]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.4} toneMapped={false} />
        </mesh>
      ))}
      <Sparkles count={26} scale={5.5} size={1.4} speed={0.25} color={accent} opacity={0.4} />
    </group>
  );
}

/* ------------------------------ Scene 6: Payoff ---------------------------- */

function PayoffScene({ accent }: { accent: string }) {
  const group = useRef<Group>(null);
  useEnter(group);
  const geometry = useMemo(() => {
    const seg = 36;
    const positions: number[] = [];
    const indices: number[] = [];
    const W = 5;
    const D = 3.2;
    for (let i = 0; i <= seg; i += 1) {
      for (let j = 0; j <= seg; j += 1) {
        const u = i / seg;
        const v = j / seg;
        const x = (u - 0.5) * W;
        const z = (v - 0.5) * D;
        const payoff = Math.max(0, (x + 0.2) * 0.7);
        const ripple = Math.sin(u * 7 + v * 5) * 0.07;
        positions.push(x, payoff + ripple - 1, z);
      }
    }
    for (let i = 0; i < seg; i += 1) {
      for (let j = 0; j < seg; j += 1) {
        const a = i * (seg + 1) + j;
        indices.push(a, a + 1, a + seg + 1, a + 1, a + seg + 2, a + seg + 1);
      }
    }
    return { positions: new Float32Array(positions), indices: new Uint16Array(indices) };
  }, []);
  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.18;
  });
  return (
    <group ref={group} rotation={[0.5, 0.2, 0]}>
      <mesh>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[geometry.positions, 3]} />
          <bufferAttribute attach="index" args={[geometry.indices, 1]} />
        </bufferGeometry>
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.5} wireframe transparent opacity={0.85} />
      </mesh>
      <Sparkles count={24} scale={5.5} size={1.6} speed={0.35} color={accent} opacity={0.4} />
    </group>
  );
}

/* ------------------------------- Composition ------------------------------- */

function ActiveScene({ scene, accent, usdInr }: { scene: SceneKey; accent: string; usdInr: number | null }) {
  switch (scene) {
    case "candles":
      return <CandleScene accent={accent} />;
    case "currency":
      return <CurrencyScene accent={accent} usdInr={usdInr} />;
    case "line":
      return <LineScene accent={accent} />;
    case "depth":
      return <DepthScene accent={accent} />;
    case "globe":
      return <GlobeScene accent={accent} />;
    case "payoff":
      return <PayoffScene accent={accent} />;
  }
}

export default function TradingScene({
  accent = "#4c9ffe",
  usdInr = null,
}: {
  accent?: string;
  usdInr?: number | null;
}) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => {
      setIndex((v) => (v + 1) % SCENES.length);
    }, 6000);
    return () => {
      window.clearInterval(timer);
    };
  }, []);
  const scene = SCENES[index] ?? "candles";

  return (
    <div className="relative h-full w-full">
      <div className="pointer-events-none absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 rounded border border-white/10 bg-black/50 px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wide text-white/85 backdrop-blur">
        <span className="h-1.5 w-1.5 rounded-full bg-[#26a69a] motion-safe:animate-pulse" />
        {SCENE_LABELS[scene]}
      </div>
      <div className="pointer-events-none absolute right-3 top-3 z-10 flex gap-1">
        {SCENES.map((key, i) => (
          <span key={key} className={`h-1 rounded-full transition-all ${i === index ? "w-4 bg-white/80" : "w-1.5 bg-white/25"}`} />
        ))}
      </div>
      <Canvas dpr={[1, 1.75]} camera={{ position: [0, 0, 6.2], fov: 42 }} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={0.7} />
        <Environment resolution={128}>
          <Lightformer form="rect" intensity={2.5} position={[3, 4, 4]} scale={7} color={accent} />
          <Lightformer form="rect" intensity={1.4} position={[-5, -1, 2]} scale={6} color="#ffffff" />
        </Environment>
        <ActiveScene key={scene} scene={scene} accent={accent} usdInr={usdInr} />
        <ContactShadows position={[0, -1.95, 0]} opacity={0.4} scale={13} blur={2.4} far={4.5} color="#000000" />
        <EffectComposer>
          <Bloom mipmapBlur intensity={0.65} luminanceThreshold={0.5} luminanceSmoothing={0.9} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
