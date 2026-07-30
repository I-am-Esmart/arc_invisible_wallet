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
    <div className="flex flex-wrap gap-3 print:hidden">
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink-heading shadow-sm transition hover:bg-slate-50"
      >
        <Link2 className="h-4 w-4" aria-hidden="true" />
        {copied ? "Copied" : "Copy receipt"}
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-2 rounded-2xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(37,99,235,0.2)] transition hover:bg-brand-hover"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        Download receipt
      </button>
      {explorerUrl ? (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-ink-heading shadow-sm transition hover:bg-slate-50"
        >
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          View transaction
        </a>
      ) : null}
    </div>
  );
}
