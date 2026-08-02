"use client";

import { useState } from "react";
import { Download, ExternalLink, Link2 } from "lucide-react";

export function ReceiptActions({
  receiptUrl,
  explorerUrl,
}: {
  receiptUrl: string;
  explorerUrl?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(receiptUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 print:hidden sm:flex-row sm:flex-wrap">
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink-heading shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100"
      >
        <Link2 className="h-4 w-4" aria-hidden="true" />
        {copied ? "Copied" : "Copy receipt"}
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-button transition hover:-translate-y-0.5 hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        Download receipt
      </button>
      {explorerUrl ? (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink-heading shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100"
        >
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          View transaction
        </a>
      ) : null}
    </div>
  );
}
