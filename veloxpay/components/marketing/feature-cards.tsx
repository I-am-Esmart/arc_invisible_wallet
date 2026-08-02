"use client";

import { Link2, ReceiptText, Shield, Users, type LucideIcon } from "lucide-react";
import { motion, type Variants } from "framer-motion";

import { EASE_OUT } from "@/components/motion/reveal";

type FeatureCard = {
  icon: LucideIcon;
  title: string;
  description: string;
};

const trustCards: FeatureCard[] = [
  {
    icon: Link2,
    title: "Payment Links",
    description: "Create clean checkout links for USDC and EURC requests in seconds.",
  },
  {
    icon: Users,
    title: "Smart Splits",
    description: "Route one payment across collaborators, vendors, and treasury wallets.",
  },
  {
    icon: Shield,
    title: "Protected Payments",
    description: "Hold funds until work is submitted, verified, and approved.",
  },
  {
    icon: ReceiptText,
    title: "Verified Receipts",
    description: "Track settlement, metadata, recipients, and explorer links after payment.",
  },
];

const groupVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE_OUT } },
};

export function FeatureCards() {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      variants={groupVariants}
      className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4"
    >
      {trustCards.map((card) => {
        const Icon = card.icon;
        const isProtected = card.title === "Protected Payments";

        return (
          <motion.div
            key={card.title}
            variants={cardVariants}
            whileHover={{ y: -5 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            className="rounded-2xl border border-line bg-white p-6 shadow-card transition duration-200 ease-out hover:shadow-[0_18px_45px_rgba(15,23,42,0.08)]"
          >
            <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              {isProtected ? (
                <motion.span
                  aria-hidden="true"
                  className="absolute inset-0 rounded-xl border-2 border-brand-300"
                  initial={{ scale: 0.6, opacity: 0.7 }}
                  whileInView={{ scale: 1.5, opacity: 0 }}
                  viewport={{ once: true, amount: 0.6 }}
                  transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.15 }}
                />
              ) : null}
              <motion.span
                initial={isProtected ? { scale: 0.7, opacity: 0, rotate: -8 } : undefined}
                whileInView={isProtected ? { scale: 1, opacity: 1, rotate: 0 } : undefined}
                viewport={{ once: true, amount: 0.6 }}
                transition={{ duration: 0.35, ease: EASE_OUT }}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
              </motion.span>
            </div>
            <h3 className="mt-5 text-lg font-semibold text-ink-heading">{card.title}</h3>
            <p className="mt-2 text-sm leading-6 text-ink-body">{card.description}</p>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
