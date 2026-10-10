import { motion, useAnimation } from "framer-motion";
import { useEffect } from "react";
import type { RiskLevel } from "../types";

const LEVEL_ANGLE: Record<RiskLevel, number> = {
  LOW: -70,
  MODERATE: -20,
  HIGH: 35,
  CRITICAL: 80,
};

const LEVEL_COLOR: Record<RiskLevel, string> = {
  LOW: "var(--color-safe)",
  MODERATE: "var(--color-amber)",
  HIGH: "var(--color-high)",
  CRITICAL: "var(--color-critical)",
};

interface Props {
  level: RiskLevel;
  confidence: number; // 0-1
  size?: number;
}

// Arc from -90deg to +90deg (semicircle), radius 130, center (150,150)
function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

export default function RiskGauge({ level, confidence, size = 300 }: Props) {
  const controls = useAnimation();
  const targetAngle = LEVEL_ANGLE[level];
  const cx = 150, cy = 160, r = 122;

  useEffect(() => {
    controls.start({ rotate: targetAngle, transition: { type: "spring", stiffness: 60, damping: 12, delay: 0.3 } });
  }, [targetAngle, controls]);

  const segments: { level: RiskLevel; start: number; end: number }[] = [
    { level: "LOW", start: -90, end: -45 },
    { level: "MODERATE", start: -45, end: 0 },
    { level: "HIGH", start: 0, end: 45 },
    { level: "CRITICAL", start: 45, end: 90 },
  ];

  return (
    <div style={{ width: size, height: size * 0.75 + 64 }} className="relative">
      <svg viewBox="0 0 300 220" className="w-full overflow-visible" style={{ height: size * 0.75 }}>
        {/* background arc track */}
        <path
          d={arcPath(cx, cy, r, -90, 90)}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth="14"
          strokeLinecap="round"
        />
        {/* colored segments */}
        {segments.map((seg, i) => (
          <motion.path
            key={seg.level}
            d={arcPath(cx, cy, r, seg.start, seg.end)}
            fill="none"
            stroke={LEVEL_COLOR[seg.level]}
            strokeWidth="14"
            strokeLinecap="butt"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.35 }}
            transition={{ duration: 0.6, delay: 0.05 * i }}
          />
        ))}
        {/* tick marks */}
        {[-90, -45, 0, 45, 90].map((angle) => {
          const p1 = polarToCartesian(cx, cy, r + 12, angle);
          const p2 = polarToCartesian(cx, cy, r + 20, angle);
          return (
            <line
              key={angle}
              x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
              stroke="var(--color-steel)" strokeWidth="1.5"
            />
          );
        })}

        {/* needle */}
        <motion.g
          style={{ originX: "150px", originY: "160px", transformOrigin: `${cx}px ${cy}px` }}
          initial={{ rotate: -90 }}
          animate={controls}
        >
          <line x1={cx} y1={cy} x2={cx} y2={cy - r + 16} stroke={LEVEL_COLOR[level]} strokeWidth="3" strokeLinecap="round" />
          <circle cx={cx} cy={cy} r="8" fill={LEVEL_COLOR[level]} />
          <circle cx={cx} cy={cy} r="4" fill="var(--color-bg)" />
        </motion.g>
      </svg>

      <motion.div
        className="absolute inset-x-0 bottom-0 flex flex-col items-center pb-1"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9, duration: 0.4 }}
      >
        <span
          className="font-display font-bold text-3xl tracking-tight"
          style={{ color: LEVEL_COLOR[level] }}
        >
          {level}
        </span>
        <span className="font-mono text-sm text-[var(--color-steel)] mt-1">
          {(confidence * 100).toFixed(1)}% confidence
        </span>
      </motion.div>
    </div>
  );
}
