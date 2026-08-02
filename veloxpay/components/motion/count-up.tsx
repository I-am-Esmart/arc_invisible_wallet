"use client";

import { animate, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";

import { EASE_OUT } from "@/components/motion/reveal";

type CountUpProps = {
  value: number;
  duration?: number;
  delay?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
};

export function CountUp({
  value,
  duration = 0.8,
  delay = 0,
  prefix = "",
  suffix = "",
  decimals = 0,
  className,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: false, amount: 0.6 });
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }

    if (!isInView) {
      node.textContent = `${prefix}0${suffix}`;
      return;
    }

    if (shouldReduceMotion) {
      node.textContent = `${prefix}${value.toFixed(decimals)}${suffix}`;
      return;
    }

    const controls = animate(0, value, {
      duration,
      delay,
      ease: EASE_OUT,
      onUpdate(latest) {
        node.textContent = `${prefix}${latest.toFixed(decimals)}${suffix}`;
      },
    });

    return () => controls.stop();
  }, [isInView, value, duration, delay, prefix, suffix, decimals, shouldReduceMotion]);

  return (
    <span ref={ref} className={className}>
      {prefix}0{suffix}
    </span>
  );
}
