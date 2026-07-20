"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";

export function PaymentLinkQr({
  url,
}: {
  url: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">QR code</h3>
          <p className="mt-1 text-xs text-slate-500">Let someone scan and pay from a phone.</p>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-200"
        >
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
      <div className="mt-4 inline-flex rounded-3xl bg-white p-4 ring-1 ring-slate-200">
        <QRCodeSVG value={url} size={168} bgColor="transparent" fgColor="#0f172a" />
      </div>
      <p className="mt-3 break-all text-xs text-slate-500">{url}</p>
    </div>
  );
}
