"use client";

import { motion, type Variants } from "framer-motion";

import { EASE_OUT } from "@/components/motion/reveal";

const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.07 },
  },
};

const wordVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE_OUT } },
};

type AnimatedHeadlineProps = {
  text: string;
  className?: string;
};

export function AnimatedHeadline({ text, className }: AnimatedHeadlineProps) {
  const words = text.split(" ");

  return (
    <motion.h1
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.4 }}
      variants={containerVariants}
    >
      {words.flatMap((word, index) => [
        <motion.span key={`word-${index}`} variants={wordVariants} className="inline-block">
          {word}
        </motion.span>,
        index < words.length - 1 ? " " : null,
      ])}
    </motion.h1>
  );
}
