"use client";

import { animate } from "framer-motion";
import type { MouseEvent, ReactNode } from "react";

import { EASE_OUT } from "@/components/motion/reveal";

type SmoothScrollLinkProps = {
  href: string;
  children: ReactNode;
  className?: string;
};

const HEADER_OFFSET = 96;

export function SmoothScrollLink({ href, children, className }: SmoothScrollLinkProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (!href.startsWith("#")) {
      return;
    }

    const id = href.slice(1);
    const target = document.getElementById(id);
    if (!target) {
      return;
    }

    event.preventDefault();

    const targetY = target.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;

    animate(window.scrollY, targetY, {
      duration: 0.9,
      ease: EASE_OUT,
      onUpdate(value) {
        window.scrollTo(0, value);
      },
      onComplete() {
        window.dispatchEvent(new CustomEvent(`section-arrival:${id}`));
      },
    });
  }

  return (
    <a href={href} className={className} onClick={handleClick}>
      {children}
    </a>
  );
}
