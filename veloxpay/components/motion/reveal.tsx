"use client";

import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

export const EASE_OUT = [0.16, 1, 0.3, 1] as const;

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  y?: number;
  once?: boolean;
  amount?: number;
};

export function Reveal({
  children,
  className,
  delay = 0,
  duration = 0.4,
  y = 20,
  once = true,
  amount = 0.3,
}: RevealProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, amount }}
      transition={{ duration, delay, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}

type RevealGroupProps = {
  children: ReactNode;
  className?: string;
  stagger?: number;
  once?: boolean;
  amount?: number;
};

function groupVariants(stagger: number): Variants {
  return {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: stagger,
      },
    },
  };
}

export function RevealGroup({
  children,
  className,
  stagger = 0.1,
  once = true,
  amount = 0.2,
}: RevealGroupProps) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount }}
      variants={groupVariants(stagger)}
    >
      {children}
    </motion.div>
  );
}

type RevealItemProps = {
  children: ReactNode;
  className?: string;
  y?: number;
  duration?: number;
};

export function RevealItem({ children, className, y = 20, duration = 0.4 }: RevealItemProps) {
  const itemVariants: Variants = {
    hidden: { opacity: 0, y },
    visible: { opacity: 1, y: 0, transition: { duration, ease: EASE_OUT } },
  };

  return (
    <motion.div className={className} variants={itemVariants}>
      {children}
    </motion.div>
  );
}
