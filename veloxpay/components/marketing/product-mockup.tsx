"use client";

import { CheckCircle, Lock } from "lucide-react";
import { motion, type Variants } from "framer-motion";

import { CountUp } from "@/components/motion/count-up";
import { EASE_OUT } from "@/components/motion/reveal";

const splitRows = [
  { name: "Developer", percent: 60, amount: 600 },
  { name: "Designer", percent: 20, amount: 200 },
  { name: "Project manager", percent: 10, amount: 100 },
  { name: "Agency treasury", percent: 10, amount: 100 },
];

const statusSteps = ["Funded", "Submitted", "Ready to release"];

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 26, rotateX: 10, rotateY: -8 },
  visible: {
    opacity: 1,
    y: 0,
    rotateX: 0,
    rotateY: 0,
    transition: { duration: 0.5, ease: EASE_OUT },
  },
};

const rowGroupVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.25 } },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE_OUT } },
};

const statusGroupVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.2, delayChildren: 0.55 } },
};

const statusVariants: Variants = {
  hidden: { opacity: 0.45, scale: 0.97, backgroundColor: "#F8FAFC", borderColor: "#E2E8F0" },
  visible: {
    opacity: 1,
    scale: 1,
    backgroundColor: "#EFF6FF",
    borderColor: "#DBEAFE",
    transition: { duration: 0.3, ease: EASE_OUT },
  },
};

const dotVariants: Variants = {
  hidden: { backgroundColor: "#CBD5E1", scale: 0.9 },
  visible: { backgroundColor: "#2563EB", scale: 1, transition: { duration: 0.2, ease: EASE_OUT } },
};

export function ProductMockup() {
  return (
    <div style={{ perspective: 1200 }} className="relative">
      <div className="absolute -left-8 top-12 z-20 hidden rounded-2xl border border-brand-100 bg-white p-4 shadow-card lg:block">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <Lock className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">Protected</div>
            <div className="text-sm font-semibold text-ink-heading">Funds held on Arc</div>
          </div>
        </div>
      </div>

      <div className="absolute -right-5 bottom-10 z-20 hidden rounded-2xl border border-line bg-white p-4 shadow-card sm:block">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">Settlement</div>
        <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-emerald-700">
          <CheckCircle className="h-4 w-4" aria-hidden="true" />
          Verified receipt ready
        </div>
      </div>

      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: false, amount: 0.4 }}
        variants={cardVariants}
        style={{ transformStyle: "preserve-3d" }}
        className="relative z-0 overflow-hidden rounded-2xl border border-line bg-white shadow-[0_24px_80px_rgba(37,99,235,0.18)]"
      >
        <div className="flex items-center gap-2 border-b border-line bg-slate-50 px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-slate-300" />
          <span className="h-3 w-3 rounded-full bg-slate-300" />
          <span className="h-3 w-3 rounded-full bg-slate-300" />
          <span className="ml-3 rounded-full bg-white px-3 py-1 text-xs font-medium text-ink-muted ring-1 ring-line">
            useveloxpay.xyz/dashboard
          </span>
        </div>

        <div className="grid gap-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="vp-eyebrow">Smart Request</div>
              <div className="mt-3 text-3xl font-semibold tracking-tight text-ink-heading">1,000 USDC</div>
              <p className="mt-2 max-w-sm text-sm leading-6 text-ink-body">
                Website development milestone with protected release.
              </p>
            </div>
            <div className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
              Arc Network
            </div>
          </div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: false, amount: 0.4 }}
            variants={rowGroupVariants}
            className="grid gap-3"
          >
            {splitRows.map((row) => (
              <motion.div
                key={row.name}
                variants={rowVariants}
                className="grid grid-cols-[1fr_auto_auto] gap-3 rounded-xl border border-line bg-slate-50 px-4 py-3 text-sm"
              >
                <span className="font-semibold text-ink-heading">{row.name}</span>
                <span className="text-ink-muted">
                  <CountUp value={row.percent} duration={1.4} suffix="%" />
                </span>
                <span className="font-semibold text-ink-heading">
                  <CountUp value={row.amount} duration={1.8} suffix=" USDC" />
                </span>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: false, amount: 0.4 }}
            variants={statusGroupVariants}
            className="grid gap-3 sm:grid-cols-3"
          >
            {statusSteps.map((label) => (
              <motion.div
                key={label}
                variants={statusVariants}
                className="rounded-xl border p-3"
              >
                <motion.div variants={dotVariants} className="h-2 w-2 rounded-full" />
                <div className="mt-3 text-sm font-semibold text-brand-700">{label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
