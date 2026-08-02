"use client";

import { CheckCircle, Link2, Send, Wallet, type LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

import { EASE_OUT } from "@/components/motion/reveal";

type Step = { icon: LucideIcon; title: string };

const steps: Step[] = [
  { icon: Wallet, title: "Create payment request" },
  { icon: Link2, title: "Share payment link" },
  { icon: Send, title: "Receive USDC/EURC" },
  { icon: CheckCircle, title: "Track settlement" },
];

export function HowItWorksSteps() {
  return (
    <div className="relative mt-8">
      <div className="pointer-events-none absolute left-[12.5%] right-[12.5%] top-[42px] hidden h-px lg:block">
        <div className="absolute inset-0 bg-line" />
        <motion.div
          className="absolute inset-0 origin-left bg-brand-500"
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.5, ease: EASE_OUT }}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.3, ease: EASE_OUT, delay: index * 0.13 }}
              className="relative rounded-2xl border border-line bg-white p-5 shadow-sm transition duration-200 ease-out hover:-translate-y-1 hover:shadow-[0_14px_35px_rgba(15,23,42,0.07)]"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <span className="text-sm font-semibold text-ink-muted">0{index + 1}</span>
              </div>
              <h3 className="mt-5 text-base font-semibold text-ink-heading">{step.title}</h3>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
