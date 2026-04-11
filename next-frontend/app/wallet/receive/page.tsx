"use client";

import { useState } from "react";
import Link from "next/link";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { WalletRequiredState } from "@/components/wallet/wallet-required-state";
import { useVeloxPayData } from "@/components/wallet/use-veloxpay-data";

export default function WalletReceivePage() {
  const [copied, setCopied] = useState(false);
  const { walletUser } = useVeloxPayData();

  if (!walletUser) {
    return <WalletRequiredState />;
  }

  async function handleCopy() {
    if (!walletUser?.address) {
      return;
    }

    await navigator.clipboard.writeText(walletUser.address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-brand-600">Wallet receive</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Receive into your wallet</h1>
        </div>
        <Button asChild variant="secondary">
          <Link href="/wallet">Back to wallet</Link>
        </Button>
      </div>

      <Card>
        <div className="flex justify-center rounded-3xl bg-slate-50 p-6">
          <QRCodeCanvas value={walletUser.address} size={240} bgColor="#ffffff" fgColor="#0f172a" />
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Wallet address</div>
          <div className="mt-2 break-all font-mono text-sm text-slate-800">{walletUser.address}</div>
        </div>

        <div className="mt-5">
          <Button onClick={handleCopy}>{copied ? "Copied" : "Copy address"}</Button>
        </div>
      </Card>
    </main>
  );
}
