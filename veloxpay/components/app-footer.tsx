"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink } from "lucide-react";

const socialLinks = [
  {
    href: "https://x.com/UseVeloxPay",
    label: "Follow VeloxPay on X",
    text: "@UseVeloxPay",
  },
  {
    href: "https://x.com/cryptosmart121",
    label: "Built by Smart on X",
    text: "Built by @cryptosmart121",
  },
];

export function AppFooter() {
  const pathname = usePathname();

  if (pathname?.startsWith("/receipt")) {
    return null;
  }

  return (
    <footer className="mt-10 border-t border-line py-6">
      <div className="flex flex-col gap-4 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between">
        <p>VeloxPay runs programmable stablecoin payment requests on Arc.</p>
        <div className="flex flex-wrap items-center gap-3">
          {socialLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              aria-label={link.label}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 font-semibold text-ink-body shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100"
            >
              {link.text}
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
