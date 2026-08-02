"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

import { EASE_OUT } from "@/components/motion/reveal";

export function CtaButton({ children }: { children: ReactNode }) {
  return (
    <motion.span
      className="relative inline-flex overflow-hidden rounded-xl"
      initial="rest"
      whileHover="hover"
      whileTap="tap"
    >
      <motion.span
        className="inline-flex"
        variants={{
          rest: { scale: 1 },
          hover: { scale: 1.03 },
          tap: { scale: 0.98 },
        }}
        transition={{ duration: 0.2, ease: EASE_OUT }}
      >
        {children}
      </motion.span>
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent"
        style={{ skewX: -20 }}
        variants={{
          rest: { x: "-140%", opacity: 0 },
          hover: { x: "260%", opacity: 1 },
          tap: { x: "260%", opacity: 1 },
        }}
        transition={{ duration: 0.5, ease: EASE_OUT }}
      />
    </motion.span>
  );
}
