"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

import { EASE_OUT } from "@/components/motion/reveal";

type ArrivalPulseProps = {
  eventName: string;
};

export function ArrivalPulse({ eventName }: ArrivalPulseProps) {
  const [isPulsing, setIsPulsing] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleArrival() {
      setIsPulsing(true);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => setIsPulsing(false), 700);
    }

    window.addEventListener(eventName, handleArrival);
    return () => {
      window.removeEventListener(eventName, handleArrival);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [eventName]);

  return (
    <AnimatePresence>
      {isPulsing ? (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-brand-300"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.9, 0] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: EASE_OUT }}
        />
      ) : null}
    </AnimatePresence>
  );
}
