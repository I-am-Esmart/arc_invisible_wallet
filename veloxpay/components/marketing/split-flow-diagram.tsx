"use client";

import { motion } from "framer-motion";

import { CountUp } from "@/components/motion/count-up";
import { EASE_OUT } from "@/components/motion/reveal";

type FlowTarget = {
  name: string;
  percent: number;
  y: number;
  strokeWidth: number;
};

const targets: FlowTarget[] = [
  { name: "Developer", percent: 60, y: 15, strokeWidth: 2.2 },
  { name: "Designer", percent: 20, y: 38, strokeWidth: 1.4 },
  { name: "Project manager", percent: 10, y: 61, strokeWidth: 0.9 },
  { name: "Agency treasury", percent: 10, y: 84, strokeWidth: 0.9 },
];

const SOURCE = { x: 18, y: 50 };
const TARGET_X = 82;

function pathFor(y: number) {
  return `M ${SOURCE.x} ${SOURCE.y} C 52 ${SOURCE.y}, 52 ${y}, ${TARGET_X} ${y}`;
}

export function SplitFlowDiagram() {
  return (
    <div className="relative h-[300px] w-full sm:h-[260px]">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        {targets.map((target, index) => (
          <motion.path
            key={target.name}
            d={pathFor(target.y)}
            fill="none"
            stroke="#2563EB"
            strokeOpacity={0.35}
            strokeWidth={target.strokeWidth}
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            whileInView={{ pathLength: 1, opacity: 1 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.7, ease: EASE_OUT, delay: index * 0.12 }}
          />
        ))}
        {targets.map((target, index) => (
          <motion.circle
            key={`${target.name}-flow`}
            r={1.4}
            fill="#2563EB"
            initial={{ opacity: 0 }}
            whileInView={{
              opacity: [0, 1, 1, 0],
              offsetDistance: ["0%", "0%", "100%", "100%"],
            }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{
              duration: 1.8,
              ease: "linear",
              repeat: Infinity,
              repeatDelay: 0.6,
              delay: 0.9 + index * 0.25,
            }}
            style={{ offsetPath: `path('${pathFor(target.y)}')` }}
          />
        ))}
      </svg>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 0.4, ease: EASE_OUT }}
        className="absolute flex w-[132px] -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded-2xl border border-brand-100 bg-white px-3 py-3 text-center shadow-card sm:w-[150px]"
        style={{ left: `${SOURCE.x}%`, top: `${SOURCE.y}%` }}
      >
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
          Incoming payment
        </span>
        <span className="mt-1 text-lg font-semibold text-ink-heading">1,000 USDC</span>
      </motion.div>

      {targets.map((target, index) => (
        <motion.div
          key={target.name}
          initial={{ opacity: 0, x: 16 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.4, ease: EASE_OUT, delay: 0.35 + index * 0.12 }}
          className="absolute w-[128px] -translate-y-1/2 rounded-xl border border-line bg-white px-3 py-2.5 shadow-sm sm:w-[144px]"
          style={{ left: `${TARGET_X}%`, top: `${target.y}%` }}
        >
          <div className="truncate text-xs font-semibold text-ink-heading">{target.name}</div>
          <div className="mt-0.5 text-sm font-semibold text-brand-700">
            <CountUp value={target.percent} duration={0.6} suffix="%" delay={0.5 + index * 0.12} />
          </div>
        </motion.div>
      ))}
    </div>
  );
}
